import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';

import { VERSIONS_REGISTRY } from './versioning/registry';

const SCENE_METADATA = 'inspector::SceneMetadata';
const ROOT = 0 as Entity;

/**
 * Resolve the SceneMetadata component version the DATA-LAYER actually speaks, so
 * the inspector reads/writes the SAME version and its edits round-trip.
 *
 * Why this exists: the Bevy editor loads/saves through a pinned `sdk-commands`
 * realm whose bundled inspector can be a version behind this one (it persists
 * `SceneMetadata-v4` while this inspector's registry advances to `-v5`). If the
 * inspector reads/writes its own latest (v5) but the host only understands v4,
 * reads miss the data and writes never persist (spawn points vanish). The host is
 * authoritative — the scene decides which sdk-commands runs — so match it instead
 * of hardcoding a version or forcing a migration.
 *
 * Detection: the data-layer's scene-provider writes the SceneMetadata component on
 * load (from scene.json), so on the engine the version WITH a value on the root is
 * the host's version. Pick the newest version that has data; if none does yet
 * (before the host's load lands), fall back to this inspector's latest.
 *
 * Both sides of a version can coexist as defined components (the registry defines
 * every version), but only the host's carries data — so this stays correct as
 * sdk-commands catches up: once it ships v5, the host writes v5 and this resolves
 * to v5 automatically. No hardcoded version, no migration, no write-down loop.
 */
type SceneComp = LastWriteWinElementSetComponentDefinition<Record<string, unknown>>;

export function resolveActiveSceneComponent(engine: IEngine): SceneComp {
  const versions = VERSIONS_REGISTRY[SCENE_METADATA];
  const names = versions.map(v => v.versionName);
  // Newest → oldest: the highest version that has data on the root is the host's.
  for (let i = names.length - 1; i >= 0; i--) {
    const comp = engine.getComponentOrNull(names[i]) as
      | (SceneComp & {
          has?: (e: Entity) => boolean;
        })
      | null;
    if (comp && comp.has?.(ROOT)) return comp;
  }
  // No data yet (host hasn't loaded the scene) — this inspector's latest. Callers
  // re-resolve on the next Scene change, by which point the host's write has landed.
  return engine.getComponent(names[names.length - 1]) as SceneComp;
}

/**
 * A `Scene` component definition that transparently delegates every operation to
 * the version the data-layer currently uses ({@link resolveActiveSceneComponent}).
 * All SceneMetadata consumers (PlayerInspector, SceneInspector, Metrics, …) use
 * `editorComponents.Scene`; wrapping it in this proxy makes their reads AND writes
 * target the host's version, so edits round-trip even when the pinned sdk-commands
 * is a version behind this inspector — without changing any consumer. When there's
 * no skew, the active version IS the latest, so this is transparent.
 *
 * Property reads (componentId/componentName/schema) and method calls all resolve
 * against the live active component, so change-matching (which compares
 * componentId) lines up with the version the host streams.
 */
export function createActiveSceneComponentProxy(engine: IEngine): SceneComp {
  return new Proxy({} as SceneComp, {
    get(_t, prop: string | symbol) {
      const target = resolveActiveSceneComponent(engine) as unknown as Record<
        string | symbol,
        unknown
      >;
      const value = target[prop];
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
    has(_t, prop) {
      return prop in (resolveActiveSceneComponent(engine) as unknown as object);
    },
  });
}
