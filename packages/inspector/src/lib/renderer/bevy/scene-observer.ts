import type { Entity } from '@dcl/ecs';
import { Vector3 } from '@dcl/ecs-math';

import type {
  RendererActivity,
  RendererActivityTracking,
  SceneEntityChange,
  Unsubscribe,
} from '../types';

/**
 * Session-recorder view of the RUNNING scene: what the scene's code creates and removes, and
 * what any of its entities looks like. The editor's own ECS only holds the authored entities;
 * the ones a game spawns while it plays (enemies, pickups, on-screen banners) exist only in the
 * engine, which answers console queries about them (`scene_entities`, `entity_components`,
 * `inspect_component`). Those reads come from the scene thread, so they are only current while
 * the scene ticks, i.e. while it plays.
 *
 * While a tracker is subscribed and the scene plays, the entity list is polled twice a second
 * and the difference reported. Everything present when play starts is the baseline and is not
 * reported. Parts created together (a creature built from several meshes) are one change, and a
 * burst of look-alikes (bullets) is one change with a count.
 */

export type ConsoleCommand = (cmd: string, args: string[]) => Promise<string>;

export interface SceneObserverOptions {
  command: ConsoleCommand;
  isRunning: () => boolean;
  intervalMs?: number;
  /** New entities described per poll; the rest are counted, not described. */
  maxDescribedPerPoll?: number;
  /** Test seams. */
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  now?: () => number;
}

export interface SceneObserver extends RendererActivityTracking {
  describeEntity(entity: Entity): Promise<string | null>;
  /** One poll, for tests. */
  poll(): Promise<void>;
  disconnect(): void;
}

type Vec3 = { x: number; y: number; z: number };
type Rgb = { r: number; g: number; b: number };

/** What the console told us about one entity. */
export type EntityFacts = {
  parent: number;
  position?: Vec3;
  /** A noun phrase with its article ("a large red box"), or null when nothing is visible. */
  description: string | null;
  /** On-screen (UI) text, reported apart from 3D objects. */
  uiText?: string;
  /** Largest scale axis: a part-built object is named after its biggest part. */
  size: number;
};

const DESCRIBE_TTL_MS = 2_000;
// A console reply that never comes must not stall the polling for the rest of the session.
const COMMAND_TIMEOUT_MS = 3_000;
// More root-level changes than this in one poll are grouped by description.
const GROUP_ABOVE = 4;
const MAX_TEXT = 60;

function article(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 1)}…` : flat;
}

/** A plain colour name for an RGB in 0..1 ("dark blue", "light grey", "orange"). */
export function colorName({ r, g, b }: Rgb): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (max < 0.12) return 'black';
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  // Judged on the spread between channels: HSL saturation blows up near white.
  if (d < 0.1 || s < 0.18) {
    if (l > 0.85) return 'white';
    return l < 0.3 ? 'dark grey' : l > 0.65 ? 'light grey' : 'grey';
  }
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  const hue =
    h < 15 || h >= 345
      ? 'red'
      : h < 40
        ? l < 0.35
          ? 'brown'
          : 'orange'
        : h < 70
          ? 'yellow'
          : h < 165
            ? 'green'
            : h < 200
              ? 'cyan'
              : h < 255
                ? 'blue'
                : h < 290
                  ? 'purple'
                  : 'pink';
  if (hue === 'brown') return hue;
  if (l < 0.3) return `dark ${hue}`;
  if (l > 0.78) return `light ${hue}`;
  return hue;
}

function shapeOf(mesh: Record<string, unknown> | undefined): string | null {
  if (!mesh) return null;
  if ('box' in mesh) return 'box';
  if ('sphere' in mesh) return 'sphere';
  if ('plane' in mesh) return 'flat panel';
  const cylinder = mesh.cylinder as { radiusTop?: number; radiusBottom?: number } | undefined;
  if (cylinder) {
    if (cylinder.radiusTop === 0) return 'cone';
    if (cylinder.radiusBottom === 0) return 'upside-down cone';
    return 'cylinder';
  }
  return 'mesh';
}

function sizeOf(scale: Vec3 | undefined): string | null {
  if (!scale) return null;
  const biggest = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
  // Entities often spawn at scale 0 and grow in: no size word rather than a wrong "tiny".
  if (biggest >= 2.5) return 'large';
  if (biggest > 0.05 && biggest <= 0.35) return 'small';
  return null;
}

type Components = {
  Transform?: { position?: Vec3; scale?: Vec3; parent?: number };
  MeshRenderer?: { mesh?: Record<string, unknown> };
  Material?: {
    material?: { pbr?: { albedoColor?: Rgb }; unlit?: { diffuseColor?: Rgb } };
  };
  GltfContainer?: { src?: string };
  TextShape?: { text?: string };
  UiText?: { value?: string };
  PointerEvents?: { pointerEvents?: { eventInfo?: { hoverText?: string } }[] };
};

/** Turn component values into what a player would call the thing. Exported for tests. */
export function describeComponents(c: Components): EntityFacts {
  const scale = c.Transform?.scale;
  const facts: EntityFacts = {
    parent: c.Transform?.parent ?? 0,
    position: c.Transform?.position,
    description: null,
    size: scale ? Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) : 1,
  };
  const uiText = c.UiText?.value?.trim();
  if (uiText) facts.uiText = clip(uiText);

  let noun: string | null = null;
  if (c.GltfContainer?.src) {
    noun = `model "${c.GltfContainer.src.split('/').pop()}"`;
  } else if (c.MeshRenderer) {
    noun = shapeOf(c.MeshRenderer.mesh);
  } else if (c.TextShape?.text) {
    noun = `3D text "${clip(c.TextShape.text)}"`;
  }
  if (!noun) return facts;

  const words: string[] = [];
  const size = sizeOf(c.Transform?.scale);
  if (size) words.push(size);
  const material = c.Material?.material;
  const color = material?.pbr?.albedoColor ?? material?.unlit?.diffuseColor;
  if (color && !c.GltfContainer) words.push(colorName(color));
  words.push(noun);
  let description = article(words.join(' '));
  const hover = c.PointerEvents?.pointerEvents?.find(p => p.eventInfo?.hoverText)?.eventInfo
    ?.hoverText;
  if (hover) description += ` (clickable: "${clip(hover)}")`;
  facts.description = description;
  return facts;
}

export function parseEntityList(reply: string): number[] {
  return reply
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+$/.test(line))
    .map(Number);
}

export function parseComponentNames(reply: string): string[] {
  return reply
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const WANTED = [
  'Transform',
  'MeshRenderer',
  'Material',
  'GltfContainer',
  'TextShape',
  'UiText',
  'PointerEvents',
] as const;

export function createSceneObserver(options: SceneObserverOptions): SceneObserver {
  const {
    command: rawCommand,
    isRunning,
    intervalMs = 500,
    maxDescribedPerPoll = 12,
    now = Date.now,
  } = options;
  const startTimer = options.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const stopTimer =
    options.clearInterval ?? (handle => clearInterval(handle as ReturnType<typeof setInterval>));

  const command: ConsoleCommand = (cmd, args) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      rawCommand(cmd, args),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${cmd} timed out`)), COMMAND_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timeout));
  };

  const trackers = new Set<(activity: RendererActivity) => void>();
  const cache = new Map<number, { facts: EntityFacts; at: number }>();
  // Entities currently alive, with what was reported about them (null = not reported).
  let known = new Map<number, string | null>();
  let wasRunning = false;
  let busy = false;
  let timer: unknown = null;

  async function facts(entity: number): Promise<EntityFacts | null> {
    const hit = cache.get(entity);
    if (hit && now() - hit.at < DESCRIBE_TTL_MS) return hit.facts;
    let names: string[];
    try {
      names = parseComponentNames(await command('entity_components', [String(entity)]));
    } catch {
      return null;
    }
    const components: Record<string, unknown> = {};
    await Promise.all(
      WANTED.filter(name => names.includes(name)).map(async name => {
        try {
          components[name] = JSON.parse(
            await command('inspect_component', [String(entity), name]),
          ) as unknown;
        } catch {
          // A component that can't be read is just left out of the description.
        }
      }),
    );
    const result = describeComponents(components as Components);
    cache.set(entity, { facts: result, at: now() });
    return result;
  }

  let seenAt = 0;
  function emit(change: Omit<SceneEntityChange, 'kind'>) {
    const activity: SceneEntityChange = { kind: 'sceneEntities', at: seenAt, ...change };
    for (const tracker of [...trackers]) tracker(activity);
  }

  function emitGrouped(
    change: 'appeared' | 'removed',
    items: { entity: number; description: string; position?: Vec3 }[],
  ) {
    if (items.length <= GROUP_ABOVE) {
      for (const item of items) {
        emit({
          change,
          entity: item.entity as Entity,
          count: 1,
          description: item.description,
          ...(item.position && {
            position: Vector3.create(item.position.x, item.position.y, item.position.z),
          }),
        });
      }
      return;
    }
    const groups = new Map<string, typeof items>();
    for (const item of items)
      groups.set(item.description, [...(groups.get(item.description) ?? []), item]);
    for (const [description, group] of groups) {
      const single = group.length === 1 ? group[0] : null;
      emit({
        change,
        entity: (single?.entity as Entity | undefined) ?? null,
        count: group.length,
        description,
        ...(single?.position && {
          position: Vector3.create(single.position.x, single.position.y, single.position.z),
        }),
      });
    }
  }

  async function listEntities(): Promise<number[] | null> {
    try {
      return parseEntityList(await command('scene_entities', []));
    } catch {
      return null;
    }
  }

  async function poll(): Promise<void> {
    if (busy || trackers.size === 0) return;
    busy = true;
    try {
      const running = isRunning();
      if (!running) {
        wasRunning = false;
        return;
      }
      const ids = await listEntities();
      if (!ids) return;
      seenAt = now();
      if (!wasRunning) {
        // Play just started: what is there now is the scene, not news.
        wasRunning = true;
        known = new Map(ids.map(id => [id, null]));
        return;
      }

      const current = new Set(ids);
      const removed = [...known.entries()].filter(([id]) => !current.has(id));
      const added = ids.filter(id => !known.has(id));
      for (const [id] of removed) {
        known.delete(id);
        cache.delete(id);
      }
      emitGrouped(
        'removed',
        removed.flatMap(([entity, description]) => (description ? [{ entity, description }] : [])),
      );
      if (added.length === 0) return;

      const described = new Map<number, EntityFacts>();
      for (const id of added.slice(0, maxDescribedPerPoll)) {
        const f = await facts(id);
        if (f) described.set(id, f);
      }
      const addedSet = new Set(added);
      const rootOf = (id: number): number => {
        let at = id;
        for (let guard = 0; guard < 32; guard++) {
          const parent = described.get(at)?.parent ?? 0;
          if (!addedSet.has(parent)) return at;
          at = parent;
        }
        return at;
      };
      const tree = new Map<number, EntityFacts[]>();
      for (const [id, f] of described) {
        const root = rootOf(id);
        tree.set(root, [...(tree.get(root) ?? []), f]);
      }

      const appeared: { entity: number; description: string; position?: Vec3 }[] = [];
      for (const id of added) known.set(id, null);
      for (const [root, parts] of tree) {
        const rootFacts = described.get(root);
        const visible = parts.filter(p => p.description);
        for (const p of parts) {
          if (p.uiText) {
            emit({
              change: 'appeared',
              entity: null,
              count: 1,
              description: `on-screen text "${p.uiText}"`,
            });
          }
        }
        if (visible.length === 0) continue;
        // A part-built object is called after its own mesh or, for an empty parent, its biggest
        // part (a creature's body, not its eye).
        const main = rootFacts?.description
          ? rootFacts
          : visible.reduce((biggest, p) => (p.size > biggest.size ? p : biggest));
        const extra = visible.length - 1;
        const description = `${main.description}${extra > 0 ? ` with ${extra} attached part${extra > 1 ? 's' : ''}` : ''}`;
        known.set(root, description);
        appeared.push({
          entity: root,
          description,
          position: rootFacts?.position ?? main.position,
        });
      }
      emitGrouped('appeared', appeared);
      const undescribed = added.length - Math.min(added.length, maxDescribedPerPoll);
      if (undescribed > 0) {
        emit({
          change: 'appeared',
          entity: null,
          count: undescribed,
          description: 'other entities (too many at once to describe)',
        });
      }
    } finally {
      busy = false;
    }
  }

  function start() {
    wasRunning = false;
    timer = startTimer(() => void poll(), intervalMs);
  }

  function stop() {
    if (timer !== null) stopTimer(timer);
    timer = null;
    known = new Map();
    cache.clear();
  }

  return {
    track: (cb): Unsubscribe => {
      trackers.add(cb);
      if (trackers.size === 1) start();
      return () => {
        if (!trackers.delete(cb)) return;
        if (trackers.size === 0) stop();
      };
    },
    describeEntity: async entity => (await facts(entity))?.description ?? null,
    poll,
    disconnect: () => {
      trackers.clear();
      stop();
    },
  };
}

/** One activity source out of several: every tracker hears all of them. */
export function combineActivitySources(
  sources: RendererActivityTracking[],
  describe?: (entity: Entity) => Promise<string | null>,
): RendererActivityTracking {
  return {
    track: cb => {
      const offs = sources.map(source => source.track(cb));
      return () => offs.forEach(off => off());
    },
    ...(describe && { describeEntity: describe }),
  };
}
