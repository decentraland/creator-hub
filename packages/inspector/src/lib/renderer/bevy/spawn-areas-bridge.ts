import type { Entity } from '@dcl/ecs';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type {
  AgentToPage,
  BusEnvelope,
  PageToScene,
  SpawnArea,
} from '@dcl/inspector-bevy-protocol';
import { resolveActiveSceneComponent } from '../../sdk/components/scene-metadata-version';
import { VERSIONS_REGISTRY } from '../../sdk/components/versioning/registry';
import type { BevySceneContext } from './BevySceneContext';

/**
 * Draw the scene's spawn AREAS in the Bevy editor (#1374). The engine shows only
 * the avatar as a proxy — it doesn't communicate WHERE the avatar can spawn, and
 * can't show multiple spawn points or their ranges. The Scene metadata's
 * `spawnPoints` carries each point's position, where each axis is either a single
 * value (a point) or a range (an area). This bridge watches that metadata and
 * posts a box per spawn point (center + half-extents) to the editor-agent scene,
 * which draws a translucent box for each — mirroring the Babylon editor.
 *
 * The inspector owns the metadata, so it recomputes + resends the full set on
 * every Scene change; an empty array clears the boxes.
 */

type Coord = { $case: 'single'; value: number } | { $case: 'range'; value: number[] };
interface SpawnPoint {
  name?: string;
  default?: boolean;
  position?: { x?: Coord; y?: Coord; z?: Coord };
}
interface SpawnSceneComponent {
  getOrNull(entity: Entity): { spawnPoints?: SpawnPoint[] } | null;
}

interface Channel {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface SpawnAreasBridgeOptions {
  context: Pick<BevySceneContext, 'onChange' | 'editorComponents' | 'engine'>;
  /**
   * Per-spawn-point visibility (the tree's eye toggle). A hidden spawn point's
   * marker is omitted from the posted set. Optional (tests / no controller) → all
   * shown. `onChange` lets the bridge re-post when a point is hidden/shown.
   */
  visibility?: {
    isHidden(name: string): boolean;
    onChange(cb: () => void): () => void;
  };
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

/** The axis midpoint: the single value, or the middle of the range. */
function coordCenter(coord: Coord | undefined): number {
  if (!coord) return 0;
  if (coord.$case === 'range') {
    if (coord.value.length === 1) return coord.value[0];
    if (coord.value.length >= 2) return (coord.value[0] + coord.value[1]) / 2;
    return 0;
  }
  return coord.value;
}

/** The axis half-extent: half the range span, or 0 for a single value (a point). */
function coordHalfExtent(coord: Coord | undefined): number {
  if (coord?.$case === 'range' && coord.value.length === 2) {
    return Math.abs(coord.value[1] - coord.value[0]) / 2;
  }
  return 0;
}

/** Map the Scene metadata's spawn points to drawable areas (scene-local). */
export function toSpawnAreas(spawnPoints: SpawnPoint[] | undefined): SpawnArea[] {
  if (!spawnPoints) return [];
  return spawnPoints.map(sp => {
    const p = sp.position ?? {};
    return {
      center: { x: coordCenter(p.x), y: coordCenter(p.y), z: coordCenter(p.z) },
      halfExtents: { x: coordHalfExtent(p.x), z: coordHalfExtent(p.z) },
      isDefault: !!sp.default,
    };
  });
}

export function createSpawnAreasBridge(options: SpawnAreasBridgeOptions): () => void {
  const { context, visibility } = options;
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);
  const RootEntity = context.engine.RootEntity;
  // Read spawn points from the SceneMetadata version the DATA-LAYER actually uses
  // (may be older than this inspector's latest — see resolveActiveSceneComponent),
  // resolved fresh each read so it self-corrects once the host's load lands.
  const activeScene = () =>
    resolveActiveSceneComponent(context.engine) as unknown as SpawnSceneComponent;
  // All SceneMetadata version ids, so onChange matches whichever the host streams.
  const sceneComponentIds = new Set(
    (VERSIONS_REGISTRY['inspector::SceneMetadata'] ?? [])
      .map(v => context.engine.getComponentOrNull(v.versionName)?.componentId)
      .filter((id): id is number => id !== undefined),
  );

  let lastPosted: string | undefined;

  const post = (force = false) => {
    const spawnPoints = activeScene().getOrNull(RootEntity)?.spawnPoints;
    // Omit spawn points hidden via the tree's eye toggle (matches Babylon, which
    // setEnabled(false)s the hidden spawn point's visuals).
    const visible = visibility
      ? (spawnPoints ?? []).filter(sp => !visibility.isHidden(sp.name ?? ''))
      : spawnPoints;
    const areas = toSpawnAreas(visible);
    const msg: PageToScene = { kind: 'set-spawn-areas', areas };
    const serialized = JSON.stringify(msg);
    // Dedupe unrelated Scene edits — but a forced post (agent (re)boot) must send
    // even an unchanged set, since the agent lost its state and needs it again.
    if (!force && serialized === lastPosted) return;
    lastPosted = serialized;
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  // The Scene component carries the spawn points; any change to it may add/move/
  // remove a spawn point (the settings form rewrites Scene). The value-dedupe in
  // post() drops the changes that didn't touch spawnPoints.
  const off = context.onChange((_entity, _op, component) => {
    if (!component || !sceneComponentIds.has(component.componentId)) return;
    post();
  });

  // Re-post when a spawn point is hidden/shown via the tree eye toggle. The set of
  // posted markers changes without the Scene metadata changing, so onChange won't
  // catch it — this does.
  const offVisibility = visibility?.onChange(() => post());

  // The agent posts `editor-ready` once its bus listener is up (and after an
  // engine reboot, which restarts it). A one-shot `set-spawn-areas` sent before
  // that is lost — so (re)send on ready. This is what makes areas appear at scene
  // init and survive reboots. Force past the dedupe: the value may be unchanged
  // but the agent still needs it.
  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!data || typeof data !== 'object') return;
    const env = data as Partial<BusEnvelope>;
    if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return;
    if ((env.msg as AgentToPage).kind === 'editor-ready') post(true);
  };

  // Also post once now, in case the agent was already ready before this bridge
  // mounted (then editor-ready won't fire again). Deduped against the ready post.
  post();

  return () => {
    channel.onmessage = null;
    off();
    offVisibility?.();
    channel.close();
  };
}
