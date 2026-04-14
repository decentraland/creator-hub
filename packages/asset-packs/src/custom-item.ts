import type { Entity, IEngine, Vector3Type } from '@dcl/ecs';
import { Name } from '@dcl/ecs';
import type { AssetComposite } from './types';
import { getNextId, COMPONENTS_WITH_ID } from './id';
import { ComponentName } from './enums';

// ----- Registry -----

type CustomItemEntry = {
  composite: AssetComposite;
  basePath: string;
};

const customItemRegistry = new Map<string, CustomItemEntry>();

/**
 * Register a custom item composite so it can be spawned at runtime.
 *
 * @param assetId   - The UUID found in the item's data.json (also stored in inspector::CustomAsset)
 * @param composite - The parsed composite.json for this custom item
 * @param basePath  - Path prefix used to resolve {assetPath} placeholders
 *                    (e.g. 'assets/custom/monster')
 *
 * @example
 * import compositeJson from '../assets/custom/monster/composite.json'
 * registerCustomItem('550e8400-e29b-41d4-a716-446655440000', compositeJson, 'assets/custom/monster')
 */
export function registerCustomItem(
  assetId: string,
  composite: AssetComposite,
  basePath: string,
): void {
  customItemRegistry.set(assetId, { composite, basePath });
}

// ----- Component-name helpers -----

/** Components that belong to the editor only and must be skipped at runtime. */
const EDITOR_COMPONENT_PREFIX = 'inspector::';

const CORE_TRANSFORM = 'core::Transform';
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_GLTF_NODE_MODIFIERS = 'core::GltfNodeModifiers';
const CORE_AUDIO_SOURCE = 'core::AudioSource';
const CORE_VIDEO_PLAYER = 'core::VideoPlayer';
const CORE_MATERIAL = 'core::Material';
const CORE_SYNC_COMPONENTS = 'core-schema::Sync-Components';

function isEditorComponent(name: string): boolean {
  return name.startsWith(EDITOR_COMPONENT_PREFIX);
}

function isSyncComponents(name: string): boolean {
  return name === CORE_SYNC_COMPONENTS;
}

// ----- {assetPath} resolution helpers -----

function resolveAssetPath(value: string, basePath: string): string {
  return value.replace('{assetPath}', basePath);
}

function resolveActionPayloadPaths(action: any, basePath: string): any {
  if (!action?.jsonPayload) return action;
  try {
    const payload = JSON.parse(action.jsonPayload);
    let changed = false;

    if (typeof payload.src === 'string' && payload.src.includes('{assetPath}')) {
      payload.src = resolveAssetPath(payload.src, basePath);
      changed = true;
    }
    if (typeof payload.audioClipUrl === 'string' && payload.audioClipUrl.includes('{assetPath}')) {
      payload.audioClipUrl = resolveAssetPath(payload.audioClipUrl, basePath);
      changed = true;
    }

    return changed ? { ...action, jsonPayload: JSON.stringify(payload) } : action;
  } catch {
    return action;
  }
}

// ----- ID remapping helpers -----

/**
 * Resolve {self:ComponentName} and {entityId:ComponentName} template references.
 * Used to remap trigger/action IDs after fresh IDs have been allocated.
 */
function resolveIdRef(
  id: string | number | undefined,
  entityIdStr: string,
  ids: Map<string, number>,
): string | number | undefined {
  if (typeof id !== 'string') return id;

  const selfMatch = id.match(/^\{self:(.+)\}$/);
  if (selfMatch) {
    const key = `${selfMatch[1]}:${entityIdStr}`;
    return ids.get(key) ?? id;
  }

  const crossMatch = id.match(/^\{(\d+):(.+)\}$/);
  if (crossMatch) {
    const [, refEntityId, componentName] = crossMatch;
    const key = `${componentName}:${refEntityId}`;
    return ids.get(key) ?? id;
  }

  return id;
}

// ----- Core spawn logic -----

/**
 * Spawn a fresh entity tree from a registered custom item.
 *
 * Call {@link registerCustomItem} first to seed the registry with the composite data.
 *
 * The spawned tree mirrors the custom item definition with all editor-only components
 * (`inspector::*`) stripped out. Multiplayer sync (`SyncComponents`/`NetworkEntity`)
 * is NOT applied in this implementation — spawned entities are local to each client.
 *
 * @param engine  - The ECS engine (passed in from scene code)
 * @param assetId - The UUID used when calling {@link registerCustomItem}
 * @param position - World position for the root entity
 * @returns The root entity of the spawned tree, or `null` if the assetId is not found
 */
/**
 * Optional callbacks for the action/trigger lifecycle of spawned entities.
 * Pass these when calling from within an action system so that each new entity
 * is properly initialised and receives the ON_SPAWN trigger event.
 */
export type SpawnCustomItemCallbacks = {
  /** Called for every entity in the spawned tree after components are applied. */
  onEntitySpawned: (entity: Entity) => void;
};

export function spawnCustomItem(
  engine: IEngine,
  assetId: string,
  position: Vector3Type,
  callbacks?: SpawnCustomItemCallbacks,
): Entity | null {
  const entry = customItemRegistry.get(assetId);
  if (!entry) {
    console.error(
      `[spawnCustomItem] Custom item '${assetId}' not found in registry. ` +
        `Call registerCustomItem() with the composite data first.`,
    );
    return null;
  }

  const { composite, basePath } = entry;
  const Transform = engine.getComponent('core::Transform') as any;

  // ---- Step 1: Build the entity ID set and parent-of map from the Transform component ----

  const transformComponent = composite.components.find(c => c.name === CORE_TRANSFORM);
  const entityIds = new Set<number>();
  const parentOf = new Map<number, number>();

  if (transformComponent) {
    for (const [entityIdStr, transformData] of Object.entries(transformComponent.data)) {
      const entityId = Number(entityIdStr);
      entityIds.add(entityId);
      const parentId = (transformData as any).json?.parent;
      if (typeof parentId === 'number') {
        parentOf.set(entityId, parentId);
        entityIds.add(parentId);
      }
    }
  }

  // Gather any entity IDs that appear only in non-Transform components
  for (const component of composite.components) {
    if (isEditorComponent(component.name) || isSyncComponents(component.name)) continue;
    for (const id of Object.keys(component.data)) {
      entityIds.add(Number(id));
    }
  }

  // ---- Step 2: Determine roots ----

  const roots = new Set<number>();
  for (const id of entityIds) {
    if (!parentOf.has(id)) roots.add(id);
  }

  if (roots.size === 0) {
    console.error(`[spawnCustomItem] No roots found in composite for asset '${assetId}'.`);
    return null;
  }

  // ---- Step 3: Read cached names ----

  const nameComponent = composite.components.find(c => c.name === Name.componentName);
  const nameOf = new Map<number, string>();
  if (nameComponent) {
    for (const [entityIdStr, nameData] of Object.entries(nameComponent.data)) {
      nameOf.set(Number(entityIdStr), (nameData as any).json?.value ?? '');
    }
  }

  // ---- Step 4: Read cached transforms ----

  const transformOf = new Map<number, any>();
  if (transformComponent) {
    for (const [entityIdStr, tData] of Object.entries(transformComponent.data)) {
      transformOf.set(Number(entityIdStr), (tData as any).json ?? {});
    }
  }

  // ---- Step 5: Create entities (two-pass for orphans) ----

  // If multi-root, create a synthetic wrapper as the single main entity
  let mainEntity: Entity | null = null;
  let defaultParentForRoots: Entity | null = null;

  if (roots.size > 1) {
    mainEntity = engine.addEntity();
    Transform.createOrReplace(mainEntity, { position });
    defaultParentForRoots = mainEntity;
  }

  const entities = new Map<number, Entity>();
  const orphanedEntities = new Map<number, number>(); // compositeId → intended parent compositeId

  for (const compositeId of entityIds) {
    const isRoot = roots.has(compositeId);
    const intendedParentCompositeId = parentOf.get(compositeId);
    const parentEntity = isRoot
      ? defaultParentForRoots ?? null
      : typeof intendedParentCompositeId === 'number'
        ? entities.get(intendedParentCompositeId)
        : undefined;

    // Track orphans (parent not yet created)
    if (
      !isRoot &&
      typeof intendedParentCompositeId === 'number' &&
      parentEntity === undefined
    ) {
      orphanedEntities.set(compositeId, intendedParentCompositeId);
    }

    const entity = engine.addEntity();
    entities.set(compositeId, entity);

    const tv = transformOf.get(compositeId);
    const pos = isRoot && roots.size === 1 ? position : (tv?.position ?? { x: 0, y: 0, z: 0 });
    const rot = tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
    const scale = tv?.scale ?? { x: 1, y: 1, z: 1 };

    if (isRoot && roots.size === 1) {
      // Single root — use as main entity, place at requested position
      mainEntity = entity;
      Transform.createOrReplace(entity, { position, rotation: rot, scale });
    } else if (isRoot) {
      // One of multiple roots — parent to wrapper
      Transform.createOrReplace(entity, {
        parent: defaultParentForRoots,
        position: pos,
        rotation: rot,
        scale,
      });
    } else {
      // Child entity
      const resolvedParent = parentEntity ?? defaultParentForRoots ?? undefined;
      Transform.createOrReplace(entity, {
        parent: resolvedParent,
        position: pos,
        rotation: rot,
        scale,
      });
    }

    // Apply Name
    const name = nameOf.get(compositeId);
    if (name) {
      Name.createOrReplace(entity, { value: name });
    }
  }

  // Re-parent orphans now that all entities exist
  for (const [compositeId, intendedParentCompositeId] of orphanedEntities) {
    const entity = entities.get(compositeId)!;
    const parentEntity = entities.get(intendedParentCompositeId);
    if (parentEntity) {
      const tv = transformOf.get(compositeId);
      Transform.createOrReplace(entity, {
        parent: parentEntity,
        position: tv?.position ?? { x: 0, y: 0, z: 0 },
        rotation: tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
        scale: tv?.scale ?? { x: 1, y: 1, z: 1 },
      });
    } else {
      console.error(
        `[spawnCustomItem] Could not reparent entity ${compositeId}: parent ${intendedParentCompositeId} not found.`,
      );
    }
  }

  // ---- Step 6: Pre-generate IDs for ID-bearing components ----

  const ids = new Map<string, number>(); // key: `${componentName}:${compositeEntityId}`

  for (const component of composite.components) {
    if (isEditorComponent(component.name) || isSyncComponents(component.name)) continue;
    if (!COMPONENTS_WITH_ID.includes(component.name)) continue;

    for (const [entityIdStr, data] of Object.entries(component.data)) {
      const rawId = (data as any).json?.id;
      if (rawId !== undefined) {
        const key = `${component.name}:${entityIdStr}`;
        ids.set(key, getNextId(engine as any));
      }
    }
  }

  // ---- Step 7: Apply remaining components ----

  for (const component of composite.components) {
    const componentName = component.name;

    // Skip editor-only
    if (isEditorComponent(componentName)) continue;

    // Skip SyncComponents (Phase 1 limitation: no multiplayer support)
    if (isSyncComponents(componentName)) {
      console.error(
        `[spawnCustomItem] Skipping SyncComponents on spawned entity — ` +
          `multiplayer sync is not supported for dynamically spawned custom items.`,
      );
      continue;
    }

    // Transform and Name are already applied above
    if (componentName === CORE_TRANSFORM || componentName === Name.componentName) continue;

    for (const [entityIdStr, rawData] of Object.entries(component.data)) {
      const compositeId = Number(entityIdStr);
      const targetEntity = entities.get(compositeId);
      if (!targetEntity) continue;

      let value = JSON.parse(JSON.stringify((rawData as any).json));

      // --- Per-component processing ---
      switch (componentName) {
        case CORE_GLTF_CONTAINER: {
          value.visibleMeshesCollisionMask ??= 0;
          value.invisibleMeshesCollisionMask ??= 3;
          if (typeof value.src === 'string') {
            value.src = resolveAssetPath(value.src, basePath);
          }
          break;
        }
        case ComponentName.PLACEHOLDER: {
          if (typeof value.src === 'string') {
            value.src = resolveAssetPath(value.src, basePath);
          }
          break;
        }
        case CORE_GLTF_NODE_MODIFIERS: {
          if (Array.isArray(value.modifiers)) {
            value.modifiers = value.modifiers.map((mod: any) => {
              if (mod?.material?.albedoTexture?.src) {
                mod.material.albedoTexture.src = resolveAssetPath(
                  mod.material.albedoTexture.src,
                  basePath,
                );
              }
              return mod;
            });
          }
          break;
        }
        case CORE_AUDIO_SOURCE: {
          if (typeof value.audioClipUrl === 'string') {
            value.audioClipUrl = resolveAssetPath(value.audioClipUrl, basePath);
          }
          break;
        }
        case CORE_VIDEO_PLAYER: {
          if (typeof value.src === 'string') {
            value.src = resolveAssetPath(value.src, basePath);
          }
          break;
        }
        case ComponentName.ACTIONS: {
          if (Array.isArray(value.value)) {
            value.value = value.value.map((action: any) =>
              resolveActionPayloadPaths(action, basePath),
            );
          }
          // Apply fresh ID
          const key = `${componentName}:${entityIdStr}`;
          if (ids.has(key)) value = { ...value, id: ids.get(key) };
          break;
        }
        case ComponentName.TRIGGERS: {
          if (Array.isArray(value.value)) {
            value.value = value.value.map((trigger: any) => ({
              ...trigger,
              conditions: (trigger.conditions ?? []).map((cond: any) => ({
                ...cond,
                id: resolveIdRef(cond.id, entityIdStr, ids),
              })),
              actions: (trigger.actions ?? []).map((act: any) => ({
                ...act,
                id: resolveIdRef(act.id, entityIdStr, ids),
              })),
            }));
          }
          break;
        }
        case ComponentName.STATES:
        case ComponentName.COUNTER: {
          // Apply fresh ID
          const key = `${componentName}:${entityIdStr}`;
          if (ids.has(key)) value = { ...value, id: ids.get(key) };
          break;
        }
        default:
          break;
      }

      // Apply component to entity
      try {
        const Component = engine.getComponent(componentName) as any;
        Component.createOrReplace(targetEntity, value);
      } catch (error) {
        console.error(
          `[spawnCustomItem] Failed to apply component '${componentName}' to entity ${compositeId}:`,
          error,
        );
      }
    }
  }

  if (!mainEntity) {
    console.error(`[spawnCustomItem] No main entity resolved for asset '${assetId}'.`);
    return null;
  }

  // ---- Step 8: Initialise action and trigger systems, emit ON_SPAWN ----

  if (callbacks?.onEntitySpawned) {
    for (const entity of entities.values()) {
      callbacks.onEntitySpawned(entity);
    }
  }

  return mainEntity;
}
