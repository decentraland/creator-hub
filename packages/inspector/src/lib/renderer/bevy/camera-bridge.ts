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
  disconnect(): void;
}

export function createCameraBridge(options: CameraBridgeOptions = {}): CameraBridge {
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);

  const setMode = (mode: CameraMode): void => {
    const msg: PageToScene = { kind: 'set-camera', mode };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  return { setMode, disconnect: () => channel.close() };
}
