import type { Entity, IEngine, TransformComponentExtended, TransformType } from '@dcl/ecs';
import type { ISDKHelpers, AssetComposite, CustomItemRegistry } from './types';
import { COMPONENTS_WITH_ID, getNextId } from './id';

/** Minimal structural type for the Triggers component (avoids circular dep with definitions.ts). */
type TriggersLike = { componentName: string };

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Map from assetId → { composite, base } populated by initAssetPacks */
let customItemRegistry: CustomItemRegistry = {};

/**
 * Register one or more custom-item composites so they can be spawned at
 * runtime via {@link spawnCustomItem}.
 * Called automatically by `initAssetPacks` when the `customItems` parameter
 * is provided.
 */
export function registerCustomItems(items: CustomItemRegistry): void {
  customItemRegistry = { ...customItemRegistry, ...items };
}

// ---------------------------------------------------------------------------
// Public spawn API
// ---------------------------------------------------------------------------

/** Optional transform override applied to the root of the spawned tree. */
export type SpawnTransform = Partial<Pick<TransformType, 'position' | 'rotation' | 'scale'>>;

/**
 * Internal reference wired up by `initAssetPacks` after all systems are
 * created (same pattern as `internalInitActions` in actions.ts).
 */
let internalSpawnCustomItem:
  | ((assetId: string, transform?: SpawnTransform) => Entity | undefined)
  | null = null;

/** @internal Called by initAssetPacks to inject the concrete implementation. */
export function setSpawnCustomItemImpl(
  impl: (assetId: string, transform?: SpawnTransform) => Entity | undefined,
): void {
  internalSpawnCustomItem = impl;
}

/**
 * Spawn a fresh entity tree from a Custom Item blueprint that was registered
 * with `initAssetPacks`.
 *
 * @param assetId - The ID of the Custom Item as registered.
 * @param transform - Optional position, rotation and scale for the spawned
 *   root entity. Defaults to the values stored in the composite.
 * @returns The spawned root entity, or `undefined` if `assetId` is not found
 *   in the registry or `initAssetPacks` has not been called yet.
 *
 * @remarks
 * Custom Items must be registered by passing a `customItems` map as the
 * fourth argument to `initAssetPacks`.
 *
 * **Multiplayer note:** Entity IDs assigned to spawned components (Actions,
 * States, Counter) are generated per-client using the local counter and are
 * therefore non-deterministic across clients. Simultaneous spawns in
 * multiplayer scenes may produce divergent cross-entity references. Full
 * multiplayer support is a future follow-up.
 *
 * @example
 * ```ts
 * import { initAssetPacks, spawnCustomItem } from '@dcl/asset-packs'
 * import { engine } from '@dcl/sdk/ecs'
 * import { Vector3 } from '@dcl/sdk/math'
 * import customItems from './custom-items.json'
 *
 * initAssetPacks(engine, undefined, undefined, customItems)
 *
 * // In a system or event handler:
 * const monster = spawnCustomItem('my-monster-id', {
 *   position: Vector3.create(5, 0, 5),
 * })
 * ```
 */
export function spawnCustomItem(
  assetId: string,
  transform?: SpawnTransform,
): Entity | undefined {
  if (!internalSpawnCustomItem) {
    console.warn('[spawnCustomItem] Asset packs not initialized. Call initAssetPacks() first.');
    return undefined;
  }
  return internalSpawnCustomItem(assetId, transform);
}

// ---------------------------------------------------------------------------
// Core implementation (not circular-dep-safe to export via definitions.ts, so
// this is called from the closure set up in scene-entrypoint.ts)
// ---------------------------------------------------------------------------

const TRANSFORM_COMPONENT_NAME = 'core::Transform';

/** Recursively replace all `{assetPath}` tokens in any JSON value. */
function resolveAssetPaths(value: unknown, base: string): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{assetPath\}/g, base);
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map(item => resolveAssetPaths(item, base));
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveAssetPaths(v, base);
    }
    return result;
  }
  return value;
}

/**
 * Materialise a composite blueprint into live engine entities.
 *
 * @internal Exposed for testing and called by the closure in
 * `scene-entrypoint.ts`. Not re-exported via `definitions.ts`.
 *
 * @param composite - The `AssetComposite` blueprint.
 * @param base - URL / path prefix used to resolve `{assetPath}` tokens.
 * @param engine - The ECS engine.
 * @param Transform - The Transform component from the engine.
 * @param Triggers - The Triggers component (asset-packs::Triggers).
 * @param sdkHelpers - Optional SDK helpers (e.g. syncEntity).
 * @param spawnTransform - Optional override for the root entity transform.
 * @param onEntitySpawned - Callback called with the full list of new entities
 *   so the caller can run `initActions` / `initTriggers` on them. This keeps
 *   the function free of circular imports.
 * @returns The root entity of the spawned tree.
 */
export function spawnCustomItemFromComposite(
  composite: AssetComposite,
  base: string,
  engine: IEngine,
  Transform: TransformComponentExtended,
  Triggers: TriggersLike,
  sdkHelpers?: ISDKHelpers,
  spawnTransform?: SpawnTransform,
  onEntitySpawned?: (allEntities: Entity[], rootEntity: Entity) => void,
): Entity {
  // ------------------------------------------------------------------
  // 1. Collect entity IDs and parent relationships from Transform data
  // ------------------------------------------------------------------
  const entityIds = new Set<number>();
  const parentOf = new Map<number, number>(); // child → parent (in composite)

  const transformComp = composite.components.find(
    c => c.name === TRANSFORM_COMPONENT_NAME,
  );
  if (transformComp) {
    for (const [entityIdStr, data] of Object.entries(transformComp.data)) {
      const entityId = Number(entityIdStr);
      entityIds.add(entityId);
      if (typeof (data.json as { parent?: number }).parent === 'number') {
        const parentId = (data.json as { parent: number }).parent;
        parentOf.set(entityId, parentId);
        entityIds.add(parentId);
      }
    }
  }

  // Also collect any entity IDs referenced only in non-Transform components
  for (const component of composite.components) {
    for (const idStr of Object.keys(component.data)) {
      entityIds.add(Number(idStr));
    }
  }

  // ------------------------------------------------------------------
  // 2. Determine root entities (those without a parent in the composite)
  // ------------------------------------------------------------------
  const roots: number[] = [];
  for (const id of entityIds) {
    if (!parentOf.has(id)) {
      roots.push(id);
    }
  }

  // ------------------------------------------------------------------
  // 3. Create engine entities; build oldCompositeId → newEntity map
  // ------------------------------------------------------------------
  const entityMap = new Map<number, Entity>();

  // wrapperRoot is non-null only for multi-root composites
  let wrapperRoot: Entity | undefined;

  if (roots.length > 1) {
    // Multi-root composite: create a transparent wrapper entity
    wrapperRoot = engine.addEntity();
    Transform.createOrReplace(wrapperRoot, {
      position: spawnTransform?.position ?? { x: 0, y: 0, z: 0 },
      rotation: spawnTransform?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      scale: spawnTransform?.scale ?? { x: 1, y: 1, z: 1 },
    });
  }

  for (const id of entityIds) {
    const e = engine.addEntity();
    entityMap.set(id, e);
  }

  const rootEntity: Entity =
    wrapperRoot !== undefined
      ? wrapperRoot
      : entityMap.get(roots[0])!;

  // ------------------------------------------------------------------
  // 4. Pre-compute new IDs for COMPONENTS_WITH_ID
  //    (Actions, States, Counter) — remap the `id` field so each
  //    spawned instance has unique, non-colliding identifiers.
  // ------------------------------------------------------------------
  // key: `componentName:compositeEntityId` → new runtime id
  const newIdByKey = new Map<string, number>();
  // old composite id number → new runtime id number (for Trigger remapping)
  const oldToNewId = new Map<number, number>();

  for (const component of composite.components) {
    const isIdComponent = COMPONENTS_WITH_ID.some(
      knownName =>
        component.name === knownName ||
        // also match versioned names: e.g. "asset-packs::Actions-v1"
        component.name.startsWith(knownName.replace(/-v\d+$/, '') + '-v') ||
        component.name.replace(/-v\d+$/, '') === knownName.replace(/-v\d+$/, ''),
    );

    if (isIdComponent) {
      for (const [entityIdStr, data] of Object.entries(component.data)) {
        const oldId = (data.json as { id?: number }).id;
        if (typeof oldId === 'number') {
          const key = `${component.name}:${entityIdStr}`;
          const newId = getNextId(engine);
          newIdByKey.set(key, newId);
          oldToNewId.set(oldId, newId);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 5. Apply components to each entity
  // ------------------------------------------------------------------
  for (const component of composite.components) {
    const { name: componentName } = component;

    for (const [entityIdStr, data] of Object.entries(component.data)) {
      const compositeEntityId = Number(entityIdStr);
      const targetEntity = entityMap.get(compositeEntityId);
      if (targetEntity === undefined) continue;

      // Deep-copy so we can mutate safely
      let value: Record<string, unknown> = JSON.parse(JSON.stringify(data.json));

      // ---- Transform: remap parent and optionally override root transform ---
      if (componentName === TRANSFORM_COMPONENT_NAME) {
        const parentId = (value as { parent?: number }).parent;
        if (typeof parentId === 'number') {
          const newParent = entityMap.get(parentId);
          if (newParent !== undefined) {
            value = { ...value, parent: newParent };
          } else {
            // Parent not in composite (edge case): fall back to wrapperRoot
            const { parent: _removed, ...rest } = value as { parent?: number } & Record<string, unknown>;
            value = wrapperRoot !== undefined ? { ...rest, parent: wrapperRoot } : rest;
          }
        } else if (wrapperRoot !== undefined && roots.includes(compositeEntityId)) {
          // Root entity in multi-root composite: parent to wrapper
          value = { ...value, parent: wrapperRoot };
        }

        // Apply caller's transform override to the single-root entity
        if (targetEntity === rootEntity && wrapperRoot === undefined) {
          if (spawnTransform?.position !== undefined) value = { ...value, position: spawnTransform.position };
          if (spawnTransform?.rotation !== undefined) value = { ...value, rotation: spawnTransform.rotation };
          if (spawnTransform?.scale !== undefined) value = { ...value, scale: spawnTransform.scale };
        }

        Transform.createOrReplace(targetEntity, value as Parameters<TransformComponentExtended['createOrReplace']>[1]);
        continue;
      }

      // ---- Remap `id` for COMPONENTS_WITH_ID --------------------------------
      const idKey = `${componentName}:${entityIdStr}`;
      const newId = newIdByKey.get(idKey);
      if (typeof newId === 'number') {
        value = { ...value, id: newId };
      }

      // ---- Remap Trigger action/condition IDs --------------------------------
      if (componentName === Triggers.componentName) {
        const triggerValue = (value as { value?: unknown[] }).value;
        if (Array.isArray(triggerValue)) {
          value = {
            ...value,
            value: triggerValue.map((trigger: unknown) => {
              const t = trigger as {
                actions?: Array<{ id?: number }>;
                conditions?: Array<{ id?: number }>;
              };
              return {
                ...(t as object),
                actions: (t.actions ?? []).map(action => ({
                  ...action,
                  id:
                    typeof action.id === 'number'
                      ? (oldToNewId.get(action.id) ?? action.id)
                      : action.id,
                })),
                conditions: (t.conditions ?? []).map(condition => ({
                  ...condition,
                  id:
                    typeof condition.id === 'number'
                      ? (oldToNewId.get(condition.id) ?? condition.id)
                      : condition.id,
                })),
              };
            }),
          };
        }
      }

      // ---- Resolve {assetPath} tokens ----------------------------------------
      value = resolveAssetPaths(value, base) as Record<string, unknown>;

      // ---- Apply component to the entity -------------------------------------
      try {
        const comp = engine.getComponent(componentName) as {
          createOrReplace: (entity: Entity, value: unknown) => void;
        };
        comp.createOrReplace(targetEntity, value);
      } catch {
        // Try stripping version suffix (e.g. "asset-packs::Actions-v1" → "asset-packs::Actions")
        const baseName = componentName.replace(/-v\d+$/, '');
        if (baseName !== componentName) {
          try {
            const comp = engine.getComponent(baseName) as {
              createOrReplace: (entity: Entity, value: unknown) => void;
            };
            comp.createOrReplace(targetEntity, value);
          } catch {
            console.warn(`[spawnCustomItem] Skipping incompatible component: ${componentName}`);
          }
        } else {
          console.warn(`[spawnCustomItem] Skipping incompatible component: ${componentName}`);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Notify caller with all spawned entities (caller runs
  //    initActions / initTriggers to avoid circular imports here)
  // ------------------------------------------------------------------
  const allEntities: Entity[] = Array.from(entityMap.values());
  if (wrapperRoot !== undefined) {
    allEntities.push(wrapperRoot);
  }

  if (onEntitySpawned) {
    onEntitySpawned(allEntities, rootEntity);
  }

  return rootEntity;
}

/**
 * Retrieve a registered custom-item entry by assetId.
 * @internal Used by the closure in scene-entrypoint.ts.
 */
export function getCustomItemEntry(assetId: string): CustomItemRegistry[string] | undefined {
  return customItemRegistry[assetId];
}
