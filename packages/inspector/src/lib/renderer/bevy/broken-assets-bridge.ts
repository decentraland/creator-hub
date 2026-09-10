import type { Entity } from '@dcl/ecs';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type {
  AgentToPage,
  BrokenAsset,
  BusEnvelope,
  PageToScene,
} from '@dcl/inspector-bevy-protocol';
import type { BevySceneContext } from './BevySceneContext';

/**
 * Draw a placeholder marker for each entity whose GltfContainer asset is
 * missing/invalid (#1465). The engine renders nothing for a broken GLTF, so a
 * deselected broken entity leaves no viewport indication. This bridge watches the
 * GltfContainer components, flags the ones whose `src` is invalid (the SAME signal
 * the Inspector's "Invalid" Path label uses), and posts their world positions to
 * the editor-agent scene, which draws a marker at each.
 *
 * The inspector owns the CRDT + the asset catalog, so it recomputes + resends the
 * full set whenever a GltfContainer, any transform, or the catalog changes; an
 * empty array clears the markers.
 */

const GLTF_CONTAINER = 'core::GltfContainer';

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface BrokenAssetsBridgeOptions {
  context: Pick<
    BevySceneContext,
    | 'onChange'
    | 'editorComponents'
    | 'engine'
    | 'getForwardableComponent'
    | 'getEntityWorldPositions'
    | 'Transform'
  >;
  /**
   * The asset-catalog validity check — whether a GltfContainer `src` resolves to a
   * real project asset. Mirrors the Inspector's Path "Invalid" flag so the marker
   * appears exactly when the field reads invalid. `onChange` re-posts when the
   * catalog changes (e.g. the missing file is restored on disk).
   */
  assets: {
    isValidSrc(src: string): boolean;
    onChange(cb: () => void): () => void;
  };
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export function createBrokenAssetsBridge(options: BrokenAssetsBridgeOptions): () => void {
  const { context, assets } = options;
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);
  const Hide = context.editorComponents.Hide;
  const gltf = context.getForwardableComponent(GLTF_CONTAINER);

  let lastPosted: string | undefined;

  const collectBroken = (): BrokenAsset[] => {
    if (!gltf) return [];
    const broken: Entity[] = [];
    for (const [entity, value] of context.engine.getEntitiesWith(gltf)) {
      const src = (value as { src?: string } | undefined)?.src;
      // Empty src isn't "broken" (nothing referenced yet); a hidden entity has no
      // visible marker (matches the rest of the editor's Hide handling).
      if (!src || assets.isValidSrc(src)) continue;
      if (Hide.getOrNull(entity)?.value) continue;
      broken.push(entity);
    }
    const worldPositions = context.getEntityWorldPositions(broken);
    const result: BrokenAsset[] = [];
    for (const entity of broken) {
      const wp = worldPositions.get(entity) ?? null;
      if (wp === null) continue; // no transform tracked → nowhere to place a marker
      result.push({ entity: entity as number, position: { x: wp.x, y: wp.y, z: wp.z } });
    }
    return result;
  };

  const post = (force = false) => {
    const msg: PageToScene = { kind: 'set-broken-assets', assets: collectBroken() };
    const serialized = JSON.stringify(msg);
    // Dedupe unrelated edits — but a forced post (agent (re)boot) must resend even
    // an unchanged set, since the agent lost its state.
    if (!force && serialized === lastPosted) return;
    lastPosted = serialized;
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  // Re-derive on any GltfContainer change (added/edited/removed src), any Transform
  // change (a broken entity or its parent moved → marker follows), and Hide toggles
  // (a hidden broken entity drops its marker). The value-dedupe in post() drops the
  // changes that don't affect the broken set.
  const gltfId = gltf?.componentId;
  const transformId = context.Transform.componentId;
  const off = context.onChange((_entity, _op, component) => {
    if (!component) {
      // An entity delete carries no component but can remove a broken entity.
      post();
      return;
    }
    if (
      component.componentId === gltfId ||
      component.componentId === transformId ||
      component.componentId === Hide.componentId
    ) {
      post();
    }
  });

  // Re-post when the asset catalog changes — a previously-broken src may now resolve
  // (file restored), or a valid one may break (file removed), without a CRDT change.
  const offAssets = assets.onChange(() => post());

  // The agent (re)posts `editor-ready` once its bus listener is up (and after an
  // engine reboot). A one-shot set-broken-assets sent before that is lost — resend
  // on ready. Force past the dedupe: the value may be unchanged but the agent needs
  // it again.
  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    if ((env.msg as AgentToPage).kind === 'editor-ready') post(true);
  };

  // Also post once now, in case the agent was already ready before this bridge
  // mounted. Deduped against the ready post.
  post();

  return () => {
    channel.onmessage = null;
    off();
    offAssets();
    channel.close();
  };
}
