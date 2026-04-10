import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition, TransformType, Vector3Type } from '@dcl/ecs';
import { Name, Tags } from '@dcl/ecs';

import type { AssetComposite } from './types';
import { getNextId } from './id';
import { ComponentName } from './enums';

// ─── Registry types ──────────────────────────────────────────────────────────

/** A single entry in the custom item registry. */
export type CustomItemRegistryEntry = {
  /** Relative path to the custom item folder, e.g. `custom/my_monster` */
  path: string;
  /** Human-readable display name of the custom item */
  name: string;
};

/**
 * The registry file written by the inspector to `custom/registry.json`.
 * Maps each custom-item UUID to its folder path and display name.
 */
export type CustomItemRegistry = Record<string, CustomItemRegistryEntry>;

// ─── Module-level cache ───────────────────────────────────────────────────────

let _registry: CustomItemRegistry | null = null;
const _compositeCache = new Map<string, AssetComposite>();

// ─── Registry loading ─────────────────────────────────────────────────────────

/**
 * Returns the custom item registry, fetching `custom/registry.json` lazily on
 * the first call.  Subsequent calls return the cached result.
 *
 * @internal
 */
async function getCustomItemRegistry(): Promise<CustomItemRegistry> {
  if (_registry !== null) return _registry;
  try {
    const res = await fetch('custom/registry.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _registry = (await res.json()) as CustomItemRegistry;
  } catch {
    // No registry means no custom items — return an empty map.
    _registry = {};
  }
  return _registry;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Optional transform overrides applied to the spawned root entity. */
export type SpawnCustomItemOptions = {
  /** Rotation quaternion for the root entity.  Defaults to identity. */
  rotation?: { x: number; y: number; z: number; w: number };
  /** Scale for the root entity.  Defaults to `{ x: 1, y: 1, z: 1 }`. */
  scale?: { x: number; y: number; z: number };
};

/**
 * Spawns a new entity tree from a Custom Item definition stored in the scene's
 * `custom/` folder.
 *
 * Custom Items are created in the Creator Hub inspector ("Create Custom Item"
 * from the right-click menu) and stored at `custom/<slug>/`.  The inspector
 * also writes a `custom/registry.json` that maps each item's UUID to its
 * folder path, allowing this function to look up items by their stable UUID.
 *
 * @param engine   - The ECS engine instance (`import { engine } from '@dcl/ecs'`).
 * @param assetId  - The UUID of the custom item (shown in the inspector), or
 *                   its display name as a fallback convenience lookup.
 * @param parent   - Parent entity for the spawned root entity.  Use
 *                   `engine.RootEntity` to place the item at the scene root.
 * @param position - World position of the spawned root entity.
 * @param options  - Optional rotation and scale for the root entity.
 * @returns The root entity of the spawned tree, or `undefined` on failure.
 *
 * @example
 * ```typescript
 * import { spawnCustomItem } from '@dcl/asset-packs'
 * import { engine } from '@dcl/ecs'
 *
 * async function spawnMonster(x: number, z: number) {
 *   const monster = await spawnCustomItem(
 *     engine,
 *     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // assetId from inspector
 *     engine.RootEntity,
 *     { x, y: 0, z },
 *   )
 *   if (monster) {
 *     console.log('Monster spawned:', monster)
 *   }
 * }
 * ```
 */
export async function spawnCustomItem(
  engine: IEngine,
  assetId: string,
  parent: Entity,
  position: Vector3Type,
  options?: SpawnCustomItemOptions,
): Promise<Entity | undefined> {
  const registry = await getCustomItemRegistry();

  // Look up by UUID first, fall back to display-name for convenience.
  let entry = registry[assetId];
  if (!entry) {
    entry = Object.values(registry).find(e => e.name === assetId)!;
  }
  if (!entry) {
    console.error(`[asset-packs] spawnCustomItem: Custom item not found: "${assetId}"`);
    return undefined;
  }

  let composite = _compositeCache.get(entry.path);
  if (!composite) {
    try {
      const res = await fetch(`${entry.path}/composite.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      composite = (await res.json()) as AssetComposite;
      _compositeCache.set(entry.path, composite);
    } catch (e) {
      console.error(
        `[asset-packs] spawnCustomItem: Failed to load composite for "${assetId}":`,
        e,
      );
      return undefined;
    }
  }

  return instantiateComposite(engine, composite, entry.path, entry.name, parent, position, options);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Components that need a stable numeric `id` field — IDs are pre-allocated
 * before any components are written so that cross-entity references resolve
 * correctly.
 */
const COMPONENTS_WITH_ID: string[] = [
  ComponentName.ACTIONS,
  ComponentName.STATES,
  ComponentName.COUNTER,
];

function isSelfRef(value: unknown): boolean {
  return `${value}` === '{self}';
}

/**
 * Resolves an `{self:ComponentName}` or `{entityId:ComponentName}` reference
 * to the pre-allocated numeric ID stored in `ids`.
 */
function resolveIdRef(
  id: string | number,
  entityIdStr: string,
  ids: Map<string, number>,
): string | number {
  if (typeof id !== 'string') return id;

  const selfMatch = id.match(/^\{self:(.+)\}$/);
  if (selfMatch) {
    return ids.get(`${selfMatch[1]}:${entityIdStr}`) ?? id;
  }

  const crossMatch = id.match(/^\{(\d+):(.+)\}$/);
  if (crossMatch) {
    return ids.get(`${crossMatch[2]}:${crossMatch[1]}`) ?? id;
  }

  return id;
}

function substituteAssetPath(value: string, basePath: string): string {
  return value.replace('{assetPath}', basePath);
}

function resolveTexture(tex: any, basePath: string): any {
  if (!tex?.tex) return tex;
  if (tex.tex.$case === 'texture') {
    return {
      tex: {
        $case: 'texture',
        texture: {
          ...tex.tex.texture,
          src: substituteAssetPath(tex.tex.texture.src ?? '', basePath),
        },
      },
    };
  }
  return tex;
}

function resolveMaterial(material: any, basePath: string): any {
  if (!material?.material) return material;
  switch (material.material.$case) {
    case 'unlit':
      return {
        material: {
          $case: 'unlit',
          unlit: {
            ...material.material.unlit,
            texture: resolveTexture(material.material.unlit.texture, basePath),
          },
        },
      };
    case 'pbr':
      return {
        material: {
          $case: 'pbr',
          pbr: {
            ...material.material.pbr,
            texture: resolveTexture(material.material.pbr.texture, basePath),
            alphaTexture: resolveTexture(material.material.pbr.alphaTexture, basePath),
            bumpTexture: resolveTexture(material.material.pbr.bumpTexture, basePath),
            emissiveTexture: resolveTexture(material.material.pbr.emissiveTexture, basePath),
          },
        },
      };
  }
  return material;
}

// Action types that reference asset file paths.
const RESOURCE_ACTION_TYPES = ['play_sound', 'play_custom_emote', 'show_image'];

/**
 * Runtime port of the inspector's `add-asset` composite instantiation.
 *
 * Differences from the inspector version:
 *   - Uses `engine.addEntity()` instead of `addChild(engine)` (no Nodes tree).
 *   - Skips editor-only components (Selection, Nodes, TransformConfig, etc.).
 *   - Does NOT call `initActions`/`initTriggers` explicitly — the actions and
 *     triggers systems pick up new entities automatically on the next tick.
 *   - Tags from the composite are merged into `engine.RootEntity`.
 */
function instantiateComposite(
  engine: IEngine,
  composite: AssetComposite,
  basePath: string,
  name: string,
  parent: Entity,
  position: Vector3Type,
  options?: SpawnCustomItemOptions,
): Entity | undefined {
  // Retrieve engine component definitions.
  const Transform = engine.getComponent(
    'core::Transform',
  ) as LastWriteWinElementSetComponentDefinition<TransformType>;
  const NameComponent = engine.getComponent(
    Name.componentName,
  ) as LastWriteWinElementSetComponentDefinition<{ value: string }>;
  const TagsComponent = engine.getComponent(
    Tags.componentName,
  ) as LastWriteWinElementSetComponentDefinition<{ tags: string[] }>;

  // Normalize position to a plain object (prevents BabylonJS Vector3 serialization issues).
  const normalizedPosition: Vector3Type = {
    x: position.x ?? 0,
    y: position.y ?? 0,
    z: position.z ?? 0,
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Step 1: Build the entity tree from the Transform component in the composite.
  // ────────────────────────────────────────────────────────────────────────────
  const entityIds = new Set<Entity>();
  const parentOf = new Map<Entity, Entity>();
  const entityNames = new Map<Entity, string>();
  const transformValues = new Map<Entity, TransformType>();

  const transformComponent = composite.components.find(c => c.name === 'core::Transform');
  const nameComponent = composite.components.find(c => c.name === Name.componentName);

  if (transformComponent) {
    for (const [entityIdStr, td] of Object.entries(transformComponent.data)) {
      const entityId = Number(entityIdStr) as Entity;
      entityIds.add(entityId);
      transformValues.set(entityId, td.json);
      if (typeof td.json.parent === 'number') {
        parentOf.set(entityId, td.json.parent as Entity);
        entityIds.add(td.json.parent as Entity);
      }
    }
  }

  if (nameComponent) {
    for (const [entityIdStr, nd] of Object.entries(nameComponent.data)) {
      entityNames.set(Number(entityIdStr) as Entity, nd.json.value);
    }
  }

  // Collect every entity ID referenced in any component.
  for (const component of composite.components) {
    for (const id of Object.keys(component.data)) {
      entityIds.add(Number(id) as Entity);
    }
  }

  // Root entities are those with no parent in the composite tree.
  const roots = new Set<Entity>();
  for (const entityId of entityIds) {
    if (!parentOf.has(entityId)) {
      roots.add(entityId);
    }
  }

  if (roots.size === 0) {
    console.error(
      '[asset-packs] instantiateComposite: Composite has no root entities — aborting spawn.',
    );
    return undefined;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step 2: Create engine entities.
  // ────────────────────────────────────────────────────────────────────────────
  const entities = new Map<Entity, Entity>();
  let defaultParent = parent;
  let mainEntity: Entity | null = null;

  if (roots.size > 1) {
    // Multiple roots: create a synthetic wrapper entity.
    mainEntity = engine.addEntity();
    NameComponent.createOrReplace(mainEntity, { value: `${name}_root` });
    Transform.createOrReplace(mainEntity, { parent, position: normalizedPosition });
    defaultParent = mainEntity;
  }

  if (entityIds.size === 1) {
    // Single entity: it IS the root and the main entity.
    mainEntity = engine.addEntity();
    NameComponent.createOrReplace(mainEntity, { value: name });
    Transform.createOrReplace(mainEntity, {
      parent,
      position: normalizedPosition,
      ...(options?.rotation ? { rotation: options.rotation } : {}),
      ...(options?.scale ? { scale: options.scale } : {}),
    });
    entities.set(entityIds.values().next().value as Entity, mainEntity);
  } else {
    // Multi-entity composite: allocate all entities, then fix orphaned parents.
    const orphaned = new Map<Entity, Entity>(); // compositeId → intendedParentCompositeId

    for (const entityId of entityIds) {
      const isRoot = roots.has(entityId);
      const intendedParentId = parentOf.get(entityId);
      const parentEntity = isRoot
        ? defaultParent
        : typeof intendedParentId === 'number'
          ? entities.get(intendedParentId)
          : undefined;

      // Parent hasn't been created yet → will be reparented in the second pass.
      if (!isRoot && typeof intendedParentId === 'number' && parentEntity === undefined) {
        orphaned.set(entityId, intendedParentId);
      }

      const entity = engine.addEntity();
      const entityName = entityNames.get(entityId) ?? (isRoot ? name : `${name}_${entityId}`);
      NameComponent.createOrReplace(entity, { value: entityName });

      const tv = transformValues.get(entityId);
      Transform.createOrReplace(entity, {
        position: tv?.position ?? { x: 0, y: 0, z: 0 },
        rotation: tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
        scale: tv?.scale ?? { x: 1, y: 1, z: 1 },
        parent: parentEntity ?? defaultParent,
      });

      entities.set(entityId, entity);
    }

    // Second pass: reparent orphaned entities now that all entities exist.
    for (const [entityId, intendedParentId] of orphaned) {
      const entity = entities.get(entityId)!;
      const parentEntity = entities.get(intendedParentId);
      if (parentEntity) {
        const tv = transformValues.get(entityId);
        Transform.createOrReplace(entity, {
          parent: parentEntity,
          position: tv?.position ?? { x: 0, y: 0, z: 0 },
          rotation: tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tv?.scale ?? { x: 1, y: 1, z: 1 },
        });
      } else {
        console.warn(
          `[asset-packs] instantiateComposite: Could not reparent entity ${entityId} — parent ${intendedParentId} not found`,
        );
      }
    }

    if (roots.size === 1) {
      const rootId = Array.from(roots)[0];
      mainEntity = entities.get(rootId)!;
      Transform.createOrReplace(mainEntity, {
        parent,
        position: normalizedPosition,
        ...(options?.rotation ? { rotation: options.rotation } : {}),
        ...(options?.scale ? { scale: options.scale } : {}),
      });
    }
  }

  if (!mainEntity) {
    console.error('[asset-packs] instantiateComposite: Failed to determine root entity.');
    return undefined;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step 3: Pre-allocate IDs for components that need a stable numeric id.
  //         This must happen BEFORE the component-application loop so that
  //         cross-entity references ({self:…} and {N:…} templates) resolve
  //         correctly.
  // ────────────────────────────────────────────────────────────────────────────
  const ids = new Map<string, number>(); // key = "ComponentName:entityIdStr"

  for (const component of composite.components) {
    if (!COMPONENTS_WITH_ID.includes(component.name)) continue;
    for (const [entityIdStr, data] of Object.entries(component.data)) {
      if (isSelfRef(data.json?.id)) {
        ids.set(`${component.name}:${entityIdStr}`, getNextId(engine));
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step 4: Apply all non-structural components to their entities.
  // ────────────────────────────────────────────────────────────────────────────
  for (const component of composite.components) {
    const componentName = component.name;

    // Transform and Name are handled in Step 2.
    if (componentName === 'core::Transform' || componentName === Name.componentName) continue;

    for (const [entityIdStr, data] of Object.entries(component.data)) {
      const compositeEntityId = Number(entityIdStr) as Entity;
      const targetEntity = entities.get(compositeEntityId);
      if (targetEntity === undefined) continue;

      // Deep-clone to avoid mutating the cached composite.
      let value: any = JSON.parse(JSON.stringify(data.json));

      switch (componentName) {
        case 'core::GltfContainer': {
          value.visibleMeshesCollisionMask ??= 0;
          value.invisibleMeshesCollisionMask ??= 3;
          value.src = substituteAssetPath(value.src ?? '', basePath);
          break;
        }
        case 'core::AudioSource': {
          value.audioClipUrl = substituteAssetPath(value.audioClipUrl ?? '', basePath);
          break;
        }
        case 'core::VideoPlayer': {
          value.src = substituteAssetPath(value.src ?? '', basePath);
          break;
        }
        case 'core::Material': {
          value = resolveMaterial(value, basePath);
          break;
        }
        case 'core::GltfNodeModifiers': {
          value.modifiers = (value.modifiers ?? []).map((m: any) => ({
            ...m,
            material: m.material ? resolveMaterial(m.material, basePath) : m.material,
          }));
          break;
        }
        case ComponentName.ACTIONS: {
          // Assign pre-generated ID.
          if (isSelfRef(value.id)) {
            value.id = ids.get(`${componentName}:${entityIdStr}`);
          }
          // Substitute {assetPath} in resource-bearing action payloads.
          if (Array.isArray(value.value)) {
            value = {
              ...value,
              value: value.value.map((action: any) => {
                if (!RESOURCE_ACTION_TYPES.includes(action.type)) return action;
                try {
                  const payload = JSON.parse(action.jsonPayload ?? '{}') as any;
                  return {
                    ...action,
                    jsonPayload: JSON.stringify({
                      ...payload,
                      src: substituteAssetPath(payload.src ?? '', basePath),
                    }),
                  };
                } catch {
                  return action;
                }
              }),
            };
          }
          break;
        }
        case ComponentName.STATES:
        case ComponentName.COUNTER: {
          if (isSelfRef(value.id)) {
            value.id = ids.get(`${componentName}:${entityIdStr}`);
          }
          break;
        }
        case ComponentName.TRIGGERS: {
          if (Array.isArray(value.value)) {
            value = {
              ...value,
              value: value.value.map((trigger: any) => ({
                ...trigger,
                conditions: (trigger.conditions ?? []).map((c: any) => ({
                  ...c,
                  id: resolveIdRef(c.id, entityIdStr, ids),
                })),
                actions: (trigger.actions ?? []).map((a: any) => ({
                  ...a,
                  id: resolveIdRef(a.id, entityIdStr, ids),
                })),
              })),
            };
          }
          break;
        }
        case 'core-schema::Sync-Components': {
          // Resolve component names to numeric IDs for runtime sync.
          const componentIds = (value.value ?? value.componentIds ?? []).reduce(
            (acc: number[], ref: string) => {
              try {
                return [...acc, engine.getComponent(ref).componentId];
              } catch {
                return acc;
              }
            },
            [],
          );
          value = { componentIds };
          // NetworkEntity must accompany SyncComponents.
          try {
            const NetworkEntity = engine.getComponent(
              'core-schema::Network-Entity',
            ) as LastWriteWinElementSetComponentDefinition<{ entityId: number; networkId: number }>;
            NetworkEntity.createOrReplace(targetEntity, { entityId: 0, networkId: 0 });
          } catch {
            // NetworkEntity not available — skip.
          }
          break;
        }
      }

      // Apply the component.  Unknown components are silently skipped.
      try {
        const Component = engine.getComponent(
          componentName,
        ) as LastWriteWinElementSetComponentDefinition<unknown>;
        Component.createOrReplace(targetEntity, value);
      } catch {
        // Component not registered in this engine version — skip gracefully.
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step 5: Merge scene-level Tags from the composite into engine.RootEntity.
  // ────────────────────────────────────────────────────────────────────────────
  const tagsComponent = composite.components.find(c => c.name === Tags.componentName);
  if (tagsComponent) {
    for (const [_, td] of Object.entries(tagsComponent.data)) {
      const incomingTags: string[] = td.json?.tags ?? [];
      if (incomingTags.length === 0) continue;

      const current = TagsComponent.getMutableOrNull(engine.RootEntity);
      if (current) {
        for (const tag of incomingTags) {
          if (!current.tags.includes(tag)) {
            current.tags.push(tag);
          }
        }
      } else {
        TagsComponent.create(engine.RootEntity, { tags: [...incomingTags] });
      }
    }
  }

  return mainEntity as Entity;
}
