/* eslint-env browser */
// Editor master mute for the Bevy engine frame. Loaded by host-boot.js BEFORE the
// engine boots, so every audio path the engine later opens goes through it:
//  - Web Audio (bevy_kira_audio → cpal → AudioContext): scene AudioSource clips and
//    the avatar's own sounds (footsteps). `AudioNode.connect` to a context's
//    destination is rerouted through a per-context master GainNode we own.
//    `OfflineAudioContext` renders to a buffer, not the speakers, so it is left alone.
//  - HTML media elements (the engine's html_video_player: VideoPlayer and
//    AudioStream): every element is forced `muted` while the editor mute is on,
//    remembering the engine's own `muted` intent (or the element's `muted`
//    attribute) so it comes back on unmute. An element is caught when it gets a
//    source, plays, or sets `muted`, so an autoplay element that is never added to
//    the document (LiveKit's `track.attach()`) is muted too. The engine drives
//    their loudness through `volume`, which `muted` leaves alone.
// The engine has no volume console command, and muting per scene component misses
// footsteps and video — this is the one place everything can be silenced.
//
// Exposed on the window as `__editorAudio` for the inspector (see the inspector's
// `engine-audio.ts`). Starts MUTED: the editor default, so nothing leaks between
// boot and the inspector's first sync.

/**
 * @param {Window & typeof globalThis} win the window to patch (the engine frame)
 * @param {{ muted?: boolean }} [options]
 */
export function installEditorAudio(win, options = {}) {
  let editorMuted = options.muted ?? true;

  // --- Web Audio: a master gain per context, spliced in front of the destination.
  /** @type {Map<BaseAudioContext, GainNode>} */
  const masterGains = new Map();
  const AudioNodeProto = win.AudioNode && win.AudioNode.prototype;
  const Destination = win.AudioDestinationNode;
  if (AudioNodeProto && Destination) {
    const originalConnect = AudioNodeProto.connect;
    const originalDisconnect = AudioNodeProto.disconnect;
    const Offline = win.OfflineAudioContext;
    const masterGain = context => {
      let gain = masterGains.get(context);
      if (!gain) {
        gain = context.createGain();
        gain.gain.value = editorMuted ? 0 : 1;
        originalConnect.call(gain, context.destination);
        masterGains.set(context, gain);
        if (typeof context.addEventListener === 'function') {
          context.addEventListener('statechange', () => {
            if (context.state === 'closed') masterGains.delete(context);
          });
        }
      }
      return gain;
    };
    const reroute = (node, target) =>
      target instanceof Destination &&
      node.context &&
      !(typeof Offline === 'function' && node.context instanceof Offline)
        ? masterGain(node.context)
        : target;
    AudioNodeProto.connect = function connect(target, ...rest) {
      return originalConnect.call(this, reroute(this, target), ...rest);
    };
    AudioNodeProto.disconnect = function disconnect(...args) {
      if (args.length > 0) args[0] = reroute(this, args[0]);
      return originalDisconnect.apply(this, args);
    };
  }

  // --- HTML media: force `muted` while the editor mute is on.
  /** @type {Set<WeakRef<HTMLMediaElement> | HTMLMediaElement>} */
  const media = new Set();
  /** @type {WeakMap<HTMLMediaElement, boolean>} the engine's own `muted` intent */
  const intended = new WeakMap();
  const MediaProto = win.HTMLMediaElement && win.HTMLMediaElement.prototype;
  const mutedDescriptor = MediaProto && Object.getOwnPropertyDescriptor(MediaProto, 'muted');
  const applyMedia = element => {
    if (!mutedDescriptor) return;
    const own = intended.has(element) ? intended.get(element) : Boolean(element.defaultMuted);
    mutedDescriptor.set.call(element, editorMuted || own);
  };
  const track = element => {
    media.add(typeof WeakRef === 'function' ? new WeakRef(element) : element);
  };
  if (MediaProto && mutedDescriptor) {
    Object.defineProperty(MediaProto, 'muted', {
      configurable: true,
      enumerable: mutedDescriptor.enumerable,
      get() {
        // Report the ENGINE's view: what it set, else the element's own default —
        // never the editor's forced mute.
        if (intended.has(this)) return intended.get(this);
        return editorMuted ? Boolean(this.defaultMuted) : mutedDescriptor.get.call(this);
      },
      set(value) {
        intended.set(this, Boolean(value));
        track(this);
        applyMedia(this);
      },
    });
    const originalPlay = MediaProto.play;
    MediaProto.play = function play(...args) {
      track(this);
      applyMedia(this);
      return originalPlay.apply(this, args);
    };
    for (const name of ['src', 'srcObject']) {
      const descriptor = Object.getOwnPropertyDescriptor(MediaProto, name);
      if (!descriptor || !descriptor.set) continue;
      Object.defineProperty(MediaProto, name, {
        ...descriptor,
        set(value) {
          track(this);
          applyMedia(this);
          descriptor.set.call(this, value);
        },
      });
    }
  }
  const eachMedia = fn => {
    for (const entry of [...media]) {
      const element =
        typeof WeakRef === 'function' && entry instanceof WeakRef ? entry.deref() : entry;
      if (element) fn(element);
      else media.delete(entry);
    }
    // Elements in the document that never played nor set `muted` (a <video> left
    // paused by the engine) are still swept, so a toggle reaches them too.
    const doc = win.document;
    if (doc && typeof doc.querySelectorAll === 'function') {
      for (const element of doc.querySelectorAll('audio, video')) fn(element);
    }
  };

  const control = {
    isMuted: () => editorMuted,
    setMuted: muted => {
      editorMuted = Boolean(muted);
      for (const [context, gain] of masterGains) {
        if (context.state === 'closed') masterGains.delete(context);
        else gain.gain.value = editorMuted ? 0 : 1;
      }
      eachMedia(applyMedia);
    },
    // Diagnostics: how much of the engine's audio is routed through this mute.
    stats: () => ({ audioContexts: masterGains.size, mediaElements: media.size }),
  };
  win.__editorAudio = control;
  return control;
}
