import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition, QuaternionType, Vector3Type } from '@dcl/ecs';
import { getNextId, COMPONENTS_WITH_ID } from './id';
import { getPayload, getJson } from './action-types';
import { ActionType } from './enums';
import type { AssetComposite } from './types';

// Component name constants used in composite.json
const CORE_TRANSFORM = 'core::Transform';
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_AUDIO_SOURCE = 'core::AudioSource';
const CORE_VIDEO_PLAYER = 'core::VideoPlayer';
const CORE_MATERIAL = 'core::Material';
const CORE_SYNC_COMPONENTS = 'core-schema::Sync-Components';
const CORE_NETWORK_ENTITY = 'core-schema::Network-Entity';
const ASSET_PACKS_ACTIONS_BASE = 'asset-packs::Actions';
const ASSET_PACKS_TRIGGERS_BASE = 'asset-packs::Triggers';
const ASSET_PACKS_PLACEHOLDER_BASE = 'asset-packs::Placeholder';

/**
 * Component name prefixes that only exist in the Inspector editor environment.
 * These components are not registered in the runtime ECS engine and must be skipped
 * when spawning composites at scene runtime.
 */
export const SPAWN_EXCLUDE_COMPONENT_PREFIXES: readonly string[] = ['inspector::'];

/**
 * Exact component names that must be excluded from runtime spawning.
 * SyncComponents and NetworkEntity require special editor-time setup and are not
 * supported in v1 of spawnComposite.
 */
export const SPAWN_EXCLUDE_COMPONENTS: readonly string[] = [
  CORE_SYNC_COMPONENTS,
  CORE_NETWORK_ENTITY,
  ASSET_PACKS_PLACEHOLDER_BASE,
];

/**
 * Options for positioning and parenting the spawned entity tree.
 */
export type SpawnCompositeOptions = {
  /** Parent entity. Defaults to engine.RootEntity. */
  parent?: Entity;
  /** World position of the root entity. Defaults to (0, 0, 0). */
  position?: Vector3Type;
  /** Rotation of the root entity. Defaults to identity quaternion. */
  rotation?: QuaternionType;
  /** Scale of the root entity. Defaults to (1, 1, 1). */
  scale?: Vector3Type;
};

function shouldSkipComponent(componentName: string): boolean {
  if (SPAWN_EXCLUDE_COMPONENTS.some(excluded => componentName === excluded || componentName.startsWith(excluded))) {
    return true;
  }
  for (const prefix of SPAWN_EXCLUDE_COMPONENT_PREFIXES) {
    if (componentName.startsWith(prefix)) return true;
  }
  return false;
}

function isSelf(value: unknown): boolean {
  return `${value}` === '{self}';
}

/**
 * Parses material component value and replaces {assetPath} tokens with the provided base path.
 */
function parseMaterial(basePath: string, material: any): any {
  if (!material?.material?.$case) return material;

  function parseTexture(texture: any): any {
    if (texture?.tex?.$case === 'texture' && texture.tex.texture?.src) {
      return {
        ...texture,
        tex: {
          ...texture.tex,
          texture: {
            ...texture.tex.texture,
            src: (texture.tex.texture.src as string).replace('{assetPath}', basePath),
          },
        },
      };
    }
    return texture;
  }

  if (material.material.$case === 'unlit') {
    return {
      ...material,
      material: {
        ...material.material,
        unlit: {
          ...material.material.unlit,
          texture: parseTexture(material.material.unlit?.texture),
        },
      },
    };
  }

  if (material.material.$case === 'pbr') {
    return {
      ...material,
      material: {
        ...material.material,
        pbr: {
          ...material.material.pbr,
          texture: parseTexture(material.material.pbr?.texture),
          alphaTexture: parseTexture(material.material.pbr?.alphaTexture),
          bumpTexture: parseTexture(material.material.pbr?.bumpTexture),
          emissiveTexture: parseTexture(material.material.pbr?.emissiveTexture),
        },
      },
    };
  }

  return material;
}

/**
 * Spawns a new entity tree from an `AssetComposite` definition at scene runtime.
 *
 * This is the runtime counterpart of the Inspector's `addAsset` operation. It reads
 * the composite JSON produced when a Custom Item is created and instantiates new ECS
 * entities with all the defined components.
 *
 * @example
 * ```typescript
 * // In your scene's game.ts:
 * import { spawn } from './custom/monster'
 *
 * // Or using spawnComposite directly:
 * import { spawnComposite } from '@dcl/asset-packs'
 * import type { AssetComposite } from '@dcl/asset-packs'
 * import monsterComposite from './custom/monster/composite.json'
 *
 * const monsterEntity = spawnComposite(
 *   engine,
 *   monsterComposite as AssetComposite,
 *   'custom/monster',
 *   { position: Vector3.create(5, 0, 5) }
 * )
 * ```
 *
 * @param engine - The ECS engine instance.
 * @param composite - The composite definition loaded from `composite.json`.
 * @param basePath - The scene-relative base path of the custom item folder
 *   (e.g. `'custom/monster'`). Used to resolve `{assetPath}` tokens in component
 *   values such as `GltfContainer.src`, `AudioSource.audioClipUrl`, and Action payloads.
 * @param options - Optional placement overrides (parent entity, position, rotation, scale).
 * @returns The root entity (or a synthetic container entity for multi-root composites).
 */
export function spawnComposite(
  engine: IEngine,
  composite: AssetComposite,
  basePath: string,
  options?: SpawnCompositeOptions,
): Entity {
  const {
    parent = engine.RootEntity as Entity,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0, w: 1 },
    scale = { x: 1, y: 1, z: 1 },
  } = options ?? {};

  const Transform = engine.getComponent(CORE_TRANSFORM) as LastWriteWinElementSetComponentDefinition<{
    position: Vector3Type;
    rotation: QuaternionType;
    scale: Vector3Type;
    parent?: Entity;
  }>;

  // -------------------------------------------------------------------------
  // Phase 1: Collect entity IDs and build the parent/transform tree
  // -------------------------------------------------------------------------

  const entityIds = new Set<number>();
  const parentOf = new Map<number, number>();
  const transformValues = new Map<number, { position?: Vector3Type; rotation?: QuaternionType; scale?: Vector3Type }>();

  const transformComponent = composite.components.find(c => c.name === CORE_TRANSFORM);
  if (transformComponent) {
    for (const [entityIdStr, rawData] of Object.entries(transformComponent.data)) {
      const entityId = Number(entityIdStr);
      entityIds.add(entityId);
      const json = (rawData as { json: any }).json;
      if (typeof json?.parent === 'number') {
        parentOf.set(entityId, json.parent);
        entityIds.add(json.parent);
      }
      transformValues.set(entityId, json ?? {});
    }
  }

  // Collect all entity IDs referenced by any component
  for (const component of composite.components) {
    for (const id of Object.keys(component.data)) {
      entityIds.add(Number(id));
    }
  }

  // Identify root entities (no parent in the composite)
  const roots = new Set<number>();
  for (const entityId of entityIds) {
    if (!parentOf.has(entityId)) {
      roots.add(entityId);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Pre-allocate new IDs for COMPONENTS_WITH_ID (Actions, States, Counter)
  //
  // This two-phase approach ensures that cross-entity Trigger references are
  // correctly resolved even when the referenced entity appears after the
  // referencing entity in the component list.
  // -------------------------------------------------------------------------

  const ids = new Map<string, number>(); // "componentName:compositeEntityId" → new numeric id
  for (const component of composite.components) {
    const { name: componentName } = component;
    if (COMPONENTS_WITH_ID.some(n => componentName === n || componentName.startsWith(n + '-v'))) {
      for (const [entityIdStr, rawData] of Object.entries(component.data)) {
        const componentValue = (rawData as { json: any }).json;
        if (isSelf(componentValue?.id)) {
          const key = `${componentName}:${entityIdStr}`;
          ids.set(key, getNextId(engine as any));
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Create entities, establishing the parent-child hierarchy
  // -------------------------------------------------------------------------

  const entities = new Map<number, Entity>();
  let mainEntity: Entity | null = null;
  let defaultParent: Entity = parent;

  if (entityIds.size === 0) {
    // Empty composite — return a bare entity at the specified position
    const fallback = engine.addEntity();
    Transform.createOrReplace(fallback, { parent, position, rotation, scale });
    return fallback;
  }

  if (roots.size > 1) {
    // Multiple roots → create a synthetic container entity that holds them all
    mainEntity = engine.addEntity();
    Transform.createOrReplace(mainEntity, { parent, position, rotation, scale });
    defaultParent = mainEntity;
  }

  if (entityIds.size === 1) {
    // Single-entity composite (the most common case)
    const singleId = entityIds.values().next().value as number;
    mainEntity = engine.addEntity();
    Transform.createOrReplace(mainEntity, { parent, position, rotation, scale });
    entities.set(singleId, mainEntity);
  } else {
    const orphanedEntities = new Map<number, number>(); // compositeId → intendedParentCompositeId

    for (const entityId of entityIds) {
      const isRoot = roots.has(entityId);
      const intendedParentId = parentOf.get(entityId);
      const parentEntity = isRoot
        ? defaultParent
        : typeof intendedParentId === 'number'
        ? entities.get(intendedParentId)
        : undefined;

      if (!isRoot && typeof intendedParentId === 'number' && parentEntity === undefined) {
        // Parent hasn't been created yet; we'll reparent after all entities exist
        orphanedEntities.set(entityId, intendedParentId);
      }

      const entity = engine.addEntity();
      const tv = transformValues.get(entityId);
      Transform.createOrReplace(entity, {
        position: tv?.position ?? { x: 0, y: 0, z: 0 },
        rotation: tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
        scale: tv?.scale ?? { x: 1, y: 1, z: 1 },
        parent: parentEntity !== undefined ? parentEntity : defaultParent,
      });

      entities.set(entityId, entity);
    }

    // Reparent orphaned entities now that all entities have been created
    for (const [entityId, intendedParentId] of orphanedEntities) {
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
        console.error(
          `spawnComposite: failed to reparent entity ${entityId} — parent ${intendedParentId} not found`,
        );
      }
    }

    // Single-root multi-entity: the root is the main entity; override its transform
    if (roots.size === 1) {
      const rootId = Array.from(roots)[0];
      mainEntity = entities.get(rootId)!;
      Transform.createOrReplace(mainEntity, { parent, position, rotation, scale });
    }
  }

  // -------------------------------------------------------------------------
  // Phase 4: Build an ID mapper for resolving cross-entity references
  // -------------------------------------------------------------------------

  /**
   * Resolves an ID reference from the composite format to a concrete integer.
   *
   * The composite stores IDs as:
   * - `{self:ComponentName}` → the newly allocated ID for that component on the current entity
   * - `{N:ComponentName}` → the newly allocated ID for that component on composite entity N
   */
  function mapId(id: string | number, entityIdStr: string): string | number {
    if (typeof id !== 'string') return id;

    const selfMatch = id.match(/^\{self:(.+)\}$/);
    if (selfMatch) {
      const componentName = selfMatch[1];
      return ids.get(`${componentName}:${entityIdStr}`) ?? id;
    }

    const crossEntityMatch = id.match(/^\{(\d+):(.+)\}$/);
    if (crossEntityMatch) {
      const refEntityId = crossEntityMatch[1];
      const componentName = crossEntityMatch[2];
      return ids.get(`${componentName}:${refEntityId}`) ?? id;
    }

    return id;
  }

  // -------------------------------------------------------------------------
  // Phase 5: Apply components to entities
  // -------------------------------------------------------------------------

  for (const component of composite.components) {
    const { name: componentName } = component;

    // Transform is handled in Phase 3; skip it here
    if (componentName === CORE_TRANSFORM) continue;

    // Skip editor-only and unsupported runtime components
    if (shouldSkipComponent(componentName)) {
      if (componentName === CORE_SYNC_COMPONENTS || componentName === CORE_NETWORK_ENTITY) {
        console.error(
          `spawnComposite: SyncComponents/NetworkEntity is not supported at runtime, skipping`,
        );
      }
      continue;
    }

    for (const [entityIdStr, rawData] of Object.entries(component.data)) {
      const entityId = Number(entityIdStr);
      const targetEntity = entities.get(entityId);
      if (targetEntity === undefined) continue;

      let componentValue: any = JSON.parse(JSON.stringify((rawData as { json: any }).json));
      const key = `${componentName}:${entityIdStr}`;

      // Assign newly allocated IDs for COMPONENTS_WITH_ID
      const isComponentWithId = COMPONENTS_WITH_ID.some(
        n => componentName === n || componentName.startsWith(n + '-v'),
      );
      if (isComponentWithId && isSelf(componentValue?.id)) {
        componentValue = { ...componentValue, id: ids.get(key) ?? componentValue.id };
      }

      // {assetPath} substitution and component-specific processing
      if (componentName === CORE_GLTF_CONTAINER) {
        componentValue = {
          ...componentValue,
          src: (componentValue.src ?? '').replace('{assetPath}', basePath),
          visibleMeshesCollisionMask: componentValue.visibleMeshesCollisionMask ?? 0,
          invisibleMeshesCollisionMask: componentValue.invisibleMeshesCollisionMask ?? 3,
        };
      } else if (componentName === CORE_AUDIO_SOURCE) {
        componentValue = {
          ...componentValue,
          audioClipUrl: (componentValue.audioClipUrl ?? '').replace('{assetPath}', basePath),
        };
      } else if (componentName === CORE_VIDEO_PLAYER) {
        componentValue = {
          ...componentValue,
          src: (componentValue.src ?? '').replace('{assetPath}', basePath),
        };
      } else if (componentName === CORE_MATERIAL) {
        componentValue = parseMaterial(basePath, componentValue);
      } else if (componentName === ASSET_PACKS_ACTIONS_BASE || componentName.startsWith(ASSET_PACKS_ACTIONS_BASE + '-v')) {
        // Remap {assetPath} in action payloads for sound/image/emote actions,
        // and remap action IDs from the pre-allocated pool
        const newValue = (componentValue.value ?? []).map((action: any) => {
          try {
            const payload = getPayload<any>(action);
            let newPayload = payload;

            if (
              action.type === ActionType.PLAY_SOUND ||
              action.type === ActionType.PLAY_CUSTOM_EMOTE ||
              action.type === ActionType.SHOW_IMAGE
            ) {
              newPayload = {
                ...payload,
                src: (payload.src ?? '').replace('{assetPath}', basePath),
              };
            }

            const newAction: any = { ...action, jsonPayload: getJson<any>(newPayload) };
            if (action.id !== undefined) {
              newAction.id = mapId(action.id, entityIdStr);
            }
            return newAction;
          } catch {
            return action;
          }
        });
        componentValue = { ...componentValue, value: newValue };
      } else if (componentName === ASSET_PACKS_TRIGGERS_BASE || componentName.startsWith(ASSET_PACKS_TRIGGERS_BASE + '-v')) {
        // Remap trigger action and condition IDs
        const newValue = (componentValue.value ?? []).map((trigger: any) => ({
          ...trigger,
          conditions: (trigger.conditions ?? []).map((condition: any) => ({
            ...condition,
            id: condition.id !== undefined ? mapId(condition.id, entityIdStr) : condition.id,
          })),
          actions: (trigger.actions ?? []).map((action: any) => ({
            ...action,
            id: action.id !== undefined ? mapId(action.id, entityIdStr) : action.id,
          })),
        }));
        componentValue = { ...componentValue, value: newValue };
      }

      // Apply the component to the entity
      try {
        const Component = engine.getComponent(
          componentName,
        ) as LastWriteWinElementSetComponentDefinition<unknown>;
        Component.createOrReplace(targetEntity, componentValue);
      } catch {
        console.error(
          `spawnComposite: component "${componentName}" is not registered in the engine, skipping`,
        );
      }
    }
  }

  if (mainEntity === null) {
    throw new Error('spawnComposite: could not determine the root entity from the composite');
  }

  return mainEntity;
}
