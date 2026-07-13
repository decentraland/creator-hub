import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Scene run/freeze bridge. Posts `set-scene-frozen` to the editor-agent scene:
 * the agent runs the engine's `/freeze_scene` / `/unfreeze_scene` console command
 * on the pinned inspection scene. Frozen = the scene's SDK7 code stops ticking
 * (static subject to edit); running = it ticks live. There's no reverse channel —
 * the inspector owns the intended state; the agent just enacts it. Mirrors the
 * camera bridge.
 */

interface Channel {
  postMessage(msg: unknown): void;
  close(): void;
}

export interface SceneRunBridge {
  /** Run the scene live (true) or freeze it to a static subject (false). */
  setRunning(running: boolean): void;
  disconnect(): void;
}

export interface SceneRunBridgeOptions {
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export function createSceneRunBridge(options: SceneRunBridgeOptions = {}): SceneRunBridge {
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);

  const setRunning = (running: boolean): void => {
    const msg: PageToScene = { kind: 'set-scene-frozen', frozen: !running };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  return {
    setRunning,
    disconnect: () => channel.close(),
  };
}
