import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, PageToScene } from '@dcl/inspector-bevy-protocol';

/**
 * Animation-names bridge. The AnimatorInspector asks the renderer for an entity's
 * GLTF animation clip names, but the GLTF is loaded in the out-of-process Bevy
 * engine — the inspector can't introspect it, and its older `@dcl/ecs` can't even
 * decode the engine's `GltfContainerLoadingState.animationNames`. So this posts a
 * `query-animations` over the same-origin BroadcastChannel and resolves with the
 * agent's `animations` reply — a request/response over the otherwise one-way bus,
 * correlated by a per-request id. Mirrors the drop-point bridge.
 *
 * If no agent answers (none configured, still booting, or the GLTF hasn't loaded)
 * it resolves `[]` within a short timeout, so the caller degrades to "no
 * animations" instead of hanging — the bus has no built-in timeout.
 */

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface AnimationsBridgeOptions {
  /** Test seam: the channel to use. Defaults to a real BroadcastChannel. */
  channel?: Channel;
  /** How long to wait for the agent's reply before resolving []. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 1000;

export interface AnimationsBridge {
  /** Ask the agent for the animation clip names of `entity`'s loaded GLTF. */
  query(entity: number): Promise<string[]>;
  /** Detach the listener and close the channel, settling any pending query []. */
  disconnect(): void;
}

export function createAnimationsBridge(options: AnimationsBridgeOptions = {}): AnimationsBridge {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const channel =
    options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as Channel);

  // Pending requests keyed by id → resolver. A reply (or timeout) settles + clears.
  const pending = new Map<number, (names: string[]) => void>();
  let nextId = 1;

  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    const msg = env.msg as { kind?: unknown; id?: unknown; names?: unknown };
    if (msg.kind !== 'animations' || typeof msg.id !== 'number') return;
    const resolve = pending.get(msg.id);
    if (!resolve) return;
    pending.delete(msg.id);
    resolve(Array.isArray(msg.names) ? (msg.names as string[]) : []);
  };

  const query = (entity: number): Promise<string[]> => {
    const id = nextId++;
    const msg: PageToScene = { kind: 'query-animations', id, entity };
    const envelope: BusEnvelope = { to: 'scene', msg };
    return new Promise<string[]>(resolve => {
      const timer = setTimeout(() => {
        if (pending.delete(id)) resolve([]);
      }, timeoutMs);
      pending.set(id, names => {
        clearTimeout(timer);
        resolve(names);
      });
      channel.postMessage(envelope);
    });
  };

  const disconnect = () => {
    channel.onmessage = null;
    for (const resolve of pending.values()) resolve([]);
    pending.clear();
    channel.close();
  };

  return { query, disconnect };
}
