import type { Entity } from '@dcl/ecs';
import { Vector3 } from '@dcl/ecs-math';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type {
  AgentToPage,
  BusActivity,
  BusEnvelope,
  BusVec3,
  PageToScene,
} from '@dcl/inspector-bevy-protocol';
import type { RendererActivity, RendererActivityTracking, Unsubscribe } from '../types';

/**
 * Session-recorder activity bridge: the Bevy side of `IRenderer.activity`. The agent
 * raycasts the pointer target, scene clicks and player position only while reporting
 * is on (it costs a raycast every few frames), so this turns it on with the first
 * tracker and off with the last, and maps the agent's `activity` messages to
 * {@link RendererActivity}.
 *
 * The agent forgets the switch when it reboots (an engine reboot restarts it), so the
 * bridge re-sends "on" on `editor-ready` while anyone is tracking.
 *
 * Its own BroadcastChannel instance, so it coexists with the other bridges (each
 * `new BroadcastChannel(name)` receives messages independently).
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface ActivityBridge extends RendererActivityTracking {
  disconnect(): void;
}

export interface ActivityBridgeOptions {
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

function isBusVec3(v: unknown): v is BusVec3 {
  if (!v || typeof v !== 'object') return false;
  const { x, y, z } = v as Partial<BusVec3>;
  return typeof x === 'number' && typeof y === 'number' && typeof z === 'number';
}

function toVector3(v: BusVec3): Vector3 {
  return Vector3.create(v.x, v.y, v.z);
}

/** Map a bus activity to the renderer contract, or null when it is malformed. */
export function toRendererActivity(activity: unknown): RendererActivity | null {
  if (!activity || typeof activity !== 'object') return null;
  const a = activity as Partial<BusActivity> & {
    entity?: unknown;
    point?: unknown;
    meshName?: unknown;
    position?: unknown;
  };
  if (a.kind === 'playerMove') {
    return isBusVec3(a.position) ? { kind: 'playerMove', position: toVector3(a.position) } : null;
  }
  if (a.kind !== 'pointerTarget' && a.kind !== 'sceneClick') return null;
  if (typeof a.entity !== 'number') return null;
  const result: Extract<RendererActivity, { kind: 'pointerTarget' | 'sceneClick' }> = {
    kind: a.kind,
    entity: a.entity === 0 ? null : (a.entity as Entity),
  };
  if (isBusVec3(a.point)) result.point = toVector3(a.point);
  if (typeof a.meshName === 'string' && a.meshName.length > 0) result.meshName = a.meshName;
  return result;
}

export function createActivityBridge(options: ActivityBridgeOptions = {}): ActivityBridge {
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);
  const trackers = new Set<(activity: RendererActivity) => void>();

  const postReporting = (enabled: boolean): void => {
    const msg: PageToScene = { kind: 'set-activity-reporting', enabled };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  channel.onmessage = ({ data }: { data: unknown }) => {
    if (trackers.size === 0) return;
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    const msg = env.msg as AgentToPage;
    if (msg.kind === 'editor-ready') {
      postReporting(true);
      return;
    }
    if (msg.kind !== 'activity') return;
    const activity = toRendererActivity(msg.activity);
    if (activity === null) return;
    for (const tracker of [...trackers]) tracker(activity);
  };

  return {
    track: (cb): Unsubscribe => {
      trackers.add(cb);
      if (trackers.size === 1) postReporting(true);
      return () => {
        if (!trackers.delete(cb)) return;
        if (trackers.size === 0) postReporting(false);
      };
    },
    disconnect: () => {
      if (trackers.size > 0) postReporting(false);
      trackers.clear();
      channel.onmessage = null;
      channel.close();
    },
  };
}
