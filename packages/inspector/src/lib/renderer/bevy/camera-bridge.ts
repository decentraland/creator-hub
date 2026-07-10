import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, CameraMode, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Editor-camera bridge: posts the chosen camera mode (native avatar ⇄ editor
 * fly-camera) to the agent, which enacts it in the engine (VirtualCamera takeover
 * + avatar-input disable). One-way fire-and-forget — the agent owns the camera;
 * the inspector only expresses intent, mirroring how the toolbar drives it.
 */

interface Channel {
  postMessage(msg: unknown): void;
  close(): void;
}

export interface CameraBridgeOptions {
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export interface CameraBridge {
  setMode(mode: CameraMode): void;
  /** Frame a target world position with the editor camera (focus-on-entity). */
  focus(position: { x: number; y: number; z: number }): void;
  disconnect(): void;
}

export function createCameraBridge(options: CameraBridgeOptions = {}): CameraBridge {
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);

  const post = (msg: PageToScene): void => {
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  return {
    setMode: (mode: CameraMode) => post({ kind: 'set-camera', mode }),
    focus: position => post({ kind: 'focus-camera', position }),
    disconnect: () => channel.close(),
  };
}
