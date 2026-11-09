import { installEditorAudio } from '../../../../scripts/bevy-engine-host/editor-audio.js';
import { setEngineAudioMuted } from './engine-audio';
import type { EditorAudioWindow } from './engine-audio';
// The engine host page's master mute, installed before the engine boots.

/**
 * The editor's mute is applied on the engine host page, where every sound comes
 * out: Web Audio graphs are routed through a master gain and HTML media elements
 * are forced muted. Driven with a fake window that stands in for the engine frame's
 * Web Audio / media classes, so the patching is exercised without a browser.
 */
describe('installEditorAudio (engine host page)', () => {
  // --- Minimal stand-ins for the browser classes the installer patches.
  class FakeAudioParam {
    value = 1;
  }
  class FakeAudioNode {
    context: FakeContext;
    connections: FakeAudioNode[] = [];
    constructor(context: FakeContext) {
      this.context = context;
    }
    connect(target: FakeAudioNode): FakeAudioNode {
      this.connections.push(target);
      return target;
    }
    disconnect(target?: FakeAudioNode): void {
      this.connections = target ? this.connections.filter(t => t !== target) : [];
    }
  }
  class FakeDestination extends FakeAudioNode {}
  class FakeGain extends FakeAudioNode {
    gain = new FakeAudioParam();
  }
  class FakeContext {
    state = 'running';
    private stateListeners: (() => void)[] = [];
    destination = new FakeDestination(this);
    addEventListener(type: string, fn: () => void): void {
      if (type === 'statechange') this.stateListeners.push(fn);
    }
    close(): void {
      this.state = 'closed';
      for (const fn of this.stateListeners) fn();
    }
    createGain(): FakeGain {
      return new FakeGain(this);
    }
  }

  function fakeWindow() {
    // Fresh subclasses per test: the installer patches the prototypes in place.
    class AudioNode extends FakeAudioNode {}
    class AudioDestinationNode extends FakeDestination {}
    class GainNode extends FakeGain {}
    // `muted` is an OWN accessor of HTMLMediaElement.prototype in browsers, which
    // is where the installer looks for it — so define it on this class directly.
    class HTMLMediaElement {
      #muted = false;
      #srcObject: unknown = null;
      defaultMuted = false;
      played = 0;
      get srcObject(): unknown {
        return this.#srcObject;
      }
      set srcObject(value: unknown) {
        this.#srcObject = value;
      }
      get muted(): boolean {
        return this.#muted;
      }
      set muted(value: boolean) {
        this.#muted = value;
      }
      play(): Promise<void> {
        this.played += 1;
        return Promise.resolve();
      }
      /** The real `muted` state, past the patched accessor. */
      realMuted(): boolean {
        return this.#muted;
      }
    }
    class Context extends FakeContext {
      destination = new AudioDestinationNode(this);
      createGain(): GainNode {
        return new GainNode(this);
      }
    }
    // Route the fake classes' prototype chain through the patched `AudioNode`.
    Object.setPrototypeOf(AudioDestinationNode.prototype, AudioNode.prototype);
    Object.setPrototypeOf(GainNode.prototype, AudioNode.prototype);
    class OfflineAudioContext extends Context {}
    const elements: HTMLMediaElement[] = [];
    const win = {
      AudioNode,
      AudioDestinationNode,
      OfflineAudioContext,
      HTMLMediaElement,
      document: { querySelectorAll: () => elements },
    } as unknown as EditorAudioWindow & {
      AudioNode: typeof AudioNode;
      HTMLMediaElement: typeof HTMLMediaElement;
    };
    return { win, Context, OfflineAudioContext, HTMLMediaElement, AudioNode, elements };
  }

  it('boots muted and exposes the control on the window', () => {
    const { win } = fakeWindow();
    const control = installEditorAudio(win);
    expect(win.__editorAudio).toBe(control);
    expect(control.isMuted()).toBe(true);
  });

  it('routes a node connected to the destination through a master gain at 0 while muted', () => {
    const { win, Context, AudioNode } = fakeWindow();
    const control = installEditorAudio(win);
    const ctx = new Context();
    const source = new AudioNode(ctx);
    source.connect(ctx.destination);

    expect(source.connections).toHaveLength(1);
    const master = source.connections[0] as FakeGain;
    expect(master).not.toBe(ctx.destination);
    expect(master.gain.value).toBe(0);
    // The master gain itself feeds the real destination.
    expect(master.connections).toEqual([ctx.destination]);

    control.setMuted(false);
    expect(master.gain.value).toBe(1);
    control.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(control.stats()).toEqual({ audioContexts: 1, mediaElements: 0 });
  });

  it('shares one master gain per context and leaves node-to-node connections alone', () => {
    const { win, Context, AudioNode } = fakeWindow();
    installEditorAudio(win);
    const ctx = new Context();
    const a = new AudioNode(ctx);
    const b = new AudioNode(ctx);
    a.connect(b);
    expect(a.connections).toEqual([b]);
    a.connect(ctx.destination);
    b.connect(ctx.destination);
    expect(a.connections[1]).toBe(b.connections[0]);
    // disconnect(destination) targets the same rerouted gain.
    a.disconnect(ctx.destination);
    expect(a.connections).toEqual([b]);
  });

  it('forces media elements muted on play and remembers the engine intent for unmute', () => {
    const { win, HTMLMediaElement } = fakeWindow();
    const control = installEditorAudio(win);
    const video = new HTMLMediaElement();
    void video.play();
    expect(video.realMuted()).toBe(true);
    // The engine reads back what IT set (nothing), not the editor's override.
    expect(video.muted).toBe(false);

    control.setMuted(false);
    expect(video.realMuted()).toBe(false);

    // An element the engine itself muted stays muted when the editor unmutes.
    const stream = new HTMLMediaElement();
    stream.muted = true;
    expect(stream.realMuted()).toBe(true);
    control.setMuted(true);
    control.setMuted(false);
    expect(stream.realMuted()).toBe(true);
    expect(stream.muted).toBe(true);
  });

  it('leaves an OfflineAudioContext render alone (it never reaches the speakers)', () => {
    const { win, OfflineAudioContext, AudioNode } = fakeWindow();
    const control = installEditorAudio(win);
    const ctx = new OfflineAudioContext();
    const source = new AudioNode(ctx);
    source.connect(ctx.destination);
    expect(source.connections).toEqual([ctx.destination]);
    expect(control.stats().audioContexts).toBe(0);
  });

  it('drops a closed context from the master gains', () => {
    const { win, Context, AudioNode } = fakeWindow();
    const control = installEditorAudio(win);
    const ctx = new Context();
    new AudioNode(ctx).connect(ctx.destination);
    expect(control.stats().audioContexts).toBe(1);
    ctx.close();
    expect(control.stats().audioContexts).toBe(0);
  });

  it('keeps an element muted by its `muted` attribute (defaultMuted) muted on unmute', () => {
    const { win, HTMLMediaElement } = fakeWindow();
    const control = installEditorAudio(win);
    const video = new HTMLMediaElement();
    video.defaultMuted = true;
    void video.play();
    control.setMuted(false);
    expect(video.realMuted()).toBe(true);
  });

  it('mutes an autoplay element that only gets a source and is never added to the document', () => {
    const { win, HTMLMediaElement } = fakeWindow();
    const control = installEditorAudio(win);
    const audio = new HTMLMediaElement();
    audio.srcObject = {};
    expect(audio.realMuted()).toBe(true);
    expect(control.stats().mediaElements).toBe(1);
    control.setMuted(false);
    expect(audio.realMuted()).toBe(false);
  });

  it('sweeps elements already in the document when toggled', () => {
    const { win, HTMLMediaElement, elements } = fakeWindow();
    const control = installEditorAudio(win);
    const idle = new HTMLMediaElement();
    elements.push(idle);
    expect(idle.realMuted()).toBe(false);
    control.setMuted(true);
    expect(idle.realMuted()).toBe(true);
    control.setMuted(false);
    expect(idle.realMuted()).toBe(false);
  });

  it('installs on a window without Web Audio or media classes (control still works)', () => {
    const win = {} as EditorAudioWindow;
    const control = installEditorAudio(win, { muted: false });
    expect(control.isMuted()).toBe(false);
    control.setMuted(true);
    expect(control.isMuted()).toBe(true);
  });
});

describe('setEngineAudioMuted (inspector side)', () => {
  it('forwards to the engine page control when present', () => {
    const setMuted = vi.fn();
    const win = {
      __editorAudio: {
        setMuted,
        isMuted: () => true,
        stats: () => ({ audioContexts: 0, mediaElements: 0 }),
      },
    } as unknown as EditorAudioWindow;
    expect(setEngineAudioMuted(win, false)).toBe(true);
    expect(setMuted).toHaveBeenCalledWith(false);
  });

  it('reports false against an engine page without the control', () => {
    expect(setEngineAudioMuted({} as EditorAudioWindow, true)).toBe(false);
  });
});
