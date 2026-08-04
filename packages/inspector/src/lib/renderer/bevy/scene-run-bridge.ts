import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { AgentToPage, BusEnvelope, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Scene run/freeze bridge. Posts `set-scene-frozen` to the editor-agent scene:
 * the agent runs the engine's `/freeze_scene` / `/unfreeze_scene` console command
 * on the pinned inspection scene. Frozen = the scene's SDK7 code stops ticking
 * (static subject to edit); running = it ticks live. The inspector owns the
 * intended state; the agent enacts it. One reverse message: `reset-complete`,
 * which the agent posts once a Stop/reset has re-pinned + re-frozen the reloaded
 * scene (see onResetComplete). Mirrors the camera bridge.
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage?: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface SceneRunBridge {
  /** Run the scene live (true) or freeze it to a static subject (false). */
  setRunning(running: boolean): void;
  /** The last requested run state (defaults to frozen — the editor boots static).
   * Used to RE-assert freeze/run after a scene reload, which drops the freeze the
   * agent applied to the previous scene instance. */
  isRunning(): boolean;
  /** Stop/reset (#1376): ask the agent to restart the inspected scene to its
   * initial state (via the engine's scene-scoped `reload`). Fast — no engine
   * reboot. The caller re-asserts freeze afterwards. */
  reset(): void;
  disconnect(): void;
}

export interface SceneRunBridgeOptions {
  /**
   * Called when the agent finishes a Stop/reset (`reset-complete`): the reloaded
   * scene is re-pinned + re-frozen (`ok:true`) or the agent gave up (`ok:false`).
   * The host uses this to re-enable Play (#1420) and replay editor overrides +
   * animation pause (#1421) exactly when the scene is ready.
   */
  onResetComplete?: (ok: boolean) => void;
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export function createSceneRunBridge(options: SceneRunBridgeOptions = {}): SceneRunBridge {
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);

  // The editor boots frozen (the agent freezes on boot); track the last intent so
  // it can be re-asserted after a scene reload.
  let running = false;

  if (options.onResetComplete) {
    channel.onmessage = ({ data }: { data: unknown }) => {
      if (!data || typeof data !== 'object') return;
      const env = data as Partial<BusEnvelope>;
      if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
      const msg = env.msg as AgentToPage;
      if (msg.kind === 'reset-complete') options.onResetComplete?.(msg.ok);
    };
  }

  const setRunning = (next: boolean): void => {
    running = next;
    const msg: PageToScene = { kind: 'set-scene-frozen', frozen: !next };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  const reset = (): void => {
    const msg: PageToScene = { kind: 'reset-scene' };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  return {
    setRunning,
    isRunning: () => running,
    reset,
    disconnect: () => {
      if (channel.onmessage) channel.onmessage = null;
      channel.close();
    },
  };
}
