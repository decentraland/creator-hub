import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { AgentToPage, BusEnvelope, BusVec3, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Spawn-point handle bridge. Posts `set-spawn-gizmo` (show a move-handle at a
 * scene-local position, or hide) to the agent, and turns the agent's
 * `spawn-gizmo-commit` (the dragged position) into a callback the spawn-point
 * controller routes to the active spawn point's form. Mirrors the other bevy
 * bridges — the agent owns the handle; the inspector expresses intent + consumes
 * the result.
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface SpawnGizmoBridgeOptions {
  /** Called with the dragged scene-local position when the agent commits a drag. */
  onCommit: (position: BusVec3) => void;
  /** Called when a viewport click hits a spawn point's avatar / camera-target
   * marker (#2), so the caller selects that spawn point / target. */
  onPick?: (index: number, target: 'position' | 'cameraTarget') => void;
  /** Test seam: the channel to use. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export interface SpawnGizmoBridge {
  /** Show the handle at a scene-local position, or hide it (null). */
  show(position: BusVec3 | null): void;
  disconnect(): void;
}

export function createSpawnGizmoBridge(options: SpawnGizmoBridgeOptions): SpawnGizmoBridge {
  const channel =
    options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as Channel);

  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    const msg = env.msg as AgentToPage;
    if (msg.kind === 'spawn-gizmo-commit') options.onCommit(msg.position);
    else if (msg.kind === 'spawn-pick') options.onPick?.(msg.index, msg.target);
  };

  const show = (position: BusVec3 | null): void => {
    const msg: PageToScene = { kind: 'set-spawn-gizmo', position };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  return {
    show,
    disconnect: () => {
      channel.onmessage = null;
      channel.close();
    },
  };
}
