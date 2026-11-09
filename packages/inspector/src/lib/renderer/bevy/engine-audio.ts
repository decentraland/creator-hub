import type { EngineWindow } from './console';

/**
 * The editor's master mute for the Bevy engine frame.
 *
 * There is no engine console command for volume, and silencing scene audio by
 * forwarding `AudioSource`/`AudioStream` with volume 0 (the previous approach)
 * reaches neither the avatar's footsteps nor a VideoPlayer's sound track — and a
 * clip already looping in the engine kept playing anyway. So the mute is applied
 * where every sound actually comes out: the engine host page (`host-boot.js` →
 * `editor-audio.js`) routes every Web Audio graph through a master gain and forces
 * every HTML media element muted, and exposes the switch on its window as
 * `__editorAudio`. The page boots MUTED (the editor default); the inspector
 * re-asserts its current state whenever it (re)binds to an engine window.
 */
export interface EditorAudioControl {
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** How much of the engine's audio is routed through the mute (diagnostics). */
  stats(): { audioContexts: number; mediaElements: number };
}

export type EditorAudioWindow = EngineWindow & { __editorAudio?: EditorAudioControl };

/** Mute/unmute everything the engine page plays. Returns false when the page
 * doesn't expose the control (an engine host page older than this inspector). */
export function setEngineAudioMuted(engineWindow: EngineWindow, muted: boolean): boolean {
  const control = (engineWindow as EditorAudioWindow).__editorAudio;
  if (!control) return false;
  control.setMuted(muted);
  return true;
}
