import { Vector3 as DclVector3 } from '@dcl/ecs-math';
import type { Vector3 } from '@dcl/ecs-math';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, BusVec3, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Drag-drop placement bridge. When an asset is dropped on the Bevy viewport the
 * inspector needs the world point under the pointer, but the raycast lives in the
 * editor-agent scene (the engine wasm isn't reachable in-process). This posts a
 * `query-drop-point` over the same-origin BroadcastChannel and resolves with the
 * agent's `drop-point` reply — a request/response over the otherwise one-way bus,
 * correlated by a per-request id.
 *
 * If no agent answers (none configured, still booting, or the pointer ray misses
 * the ground) it resolves `null` within a short timeout, so the caller degrades
 * to its default placement instead of hanging — the bus, like the scene RPC, has
 * no built-in timeout.
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface DropPointBridgeOptions {
  /** Test seam: the channel to use. Defaults to a real BroadcastChannel. */
  channel?: Channel;
  /** How long to wait for the agent's reply before resolving null. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 1000;

export interface DropPointBridge {
  /**
   * Ask the agent for the ground point (scene-local) under a viewport position.
   * `ndc` is the drop point in normalized device coords (x,y ∈ [-1,1], y up); the
   * agent raycasts from there (the engine's own pointer is stale during an HTML5
   * drag). Omit to use the engine's current pointer.
   */
  query(ndc?: { x: number; y: number }): Promise<Vector3 | null>;
  /** Detach the listener and close the channel, settling any pending query null. */
  disconnect(): void;
}

export function createDropPointBridge(options: DropPointBridgeOptions = {}): DropPointBridge {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const channel =
    options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as Channel);

  // Pending requests keyed by id → resolver. A reply (or timeout) settles + clears.
  const pending = new Map<number, (point: Vector3 | null) => void>();
  let nextId = 1;

  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    const msg = env.msg as { kind?: unknown; id?: unknown; position?: BusVec3 | null };
    if (msg.kind !== 'drop-point' || typeof msg.id !== 'number') return;
    const resolve = pending.get(msg.id);
    if (!resolve) return;
    pending.delete(msg.id);
    const p = msg.position;
    resolve(p ? DclVector3.create(p.x, p.y, p.z) : null);
  };

  const query = (ndc?: { x: number; y: number }): Promise<Vector3 | null> => {
    const id = nextId++;
    const msg: PageToScene = { kind: 'query-drop-point', id, ...(ndc ? { ndc } : {}) };
    const envelope: BusEnvelope = { to: 'scene', msg };
    return new Promise<Vector3 | null>(resolve => {
      const timer = setTimeout(() => {
        if (pending.delete(id)) resolve(null);
      }, timeoutMs);
      pending.set(id, point => {
        clearTimeout(timer);
        resolve(point);
      });
      channel.postMessage(envelope);
    });
  };

  const disconnect = () => {
    channel.onmessage = null;
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
    channel.close();
  };

  return { query, disconnect };
}
