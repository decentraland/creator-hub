import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type {
  AgentToPage,
  BusEnvelope,
  BusVec3,
  CameraMode,
  PageToScene,
} from '@dcl/inspector-bevy-protocol';

/**
 * Editor-camera bridge: posts the chosen camera mode (native avatar ⇄ editor
 * fly-camera) to the agent, which enacts it in the engine (VirtualCamera takeover
 * + avatar-input disable). Mostly one-way (the agent owns the camera; the
 * inspector expresses intent), plus one reverse stream: the agent reports the
 * fly-camera's live pose (`camera-pose`) so the minimap can track it — delivered
 * to `onPose`.
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface CameraBridgeOptions {
  /** Called with the fly-camera's live pose (scene-local) as the agent streams it. */
  onPose?: (pose: { position: BusVec3; target: BusVec3 }) => void;
  /** Test seam: the channel to use. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export interface CameraBridge {
  setMode(mode: CameraMode): void;
  /** Frame a target world position with the editor camera (focus-on-entity). */
  focus(position: { x: number; y: number; z: number }): void;
  /** Reset the editor camera to a default framing of the given scene-local point. */
  reset(position: { x: number; y: number; z: number }): void;
  /**
   * Forward the vertical fly-camera held state (E = up, Q = down). Q has no SDK
   * InputAction, so the engine can't read it; the host captures E/Q and pushes the
   * held state to the agent's fly camera.
   */
  setVertical(up: boolean, down: boolean): void;
  disconnect(): void;
}

export function createCameraBridge(options: CameraBridgeOptions = {}): CameraBridge {
  const channel =
    options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as Channel);

  const post = (msg: PageToScene): void => {
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  if (options.onPose) {
    channel.onmessage = ({ data }: { data: unknown }) => {
      if (!data || typeof data !== 'object') return;
      const env = data as Partial<BusEnvelope>;
      if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
      const msg = env.msg as AgentToPage;
      if (msg.kind === 'camera-pose')
        options.onPose?.({ position: msg.position, target: msg.target });
    };
  }

  return {
    setMode: (mode: CameraMode) => post({ kind: 'set-camera', mode }),
    focus: position => post({ kind: 'focus-camera', position }),
    reset: position => post({ kind: 'reset-camera', position }),
    setVertical: (up: boolean, down: boolean) => post({ kind: 'set-vertical-input', up, down }),
    disconnect: () => {
      channel.onmessage = null;
      channel.close();
    },
  };
}
