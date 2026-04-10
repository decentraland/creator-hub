import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBMaterial,
  QuaternionType,
  TextureUnion,
  Vector3Type,
} from '@dcl/ecs';
import { getComponentEntityTree } from '@dcl/ecs';
import {
  Name as DefineName,
  Transform as DefineTransform,
} from '@dcl/ecs/dist/components';
import { getJson, getPayload } from './action-types';
import { getExplorerComponents } from './components';
import { ActionType } from './enums';
import { COMPONENTS_WITH_ID, getNextId } from './id';
import type { AssetComposite, ISDKHelpers } from './types';

// Component name constants (mirrors inspector's CoreComponents)
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_GLTF_NODE_MODIFIERS = 'core::GltfNodeModifiers';
const CORE_AUDIO_SOURCE = 'core::AudioSource';
const CORE_VIDEO_PLAYER = 'core::VideoPlayer';
const CORE_MATERIAL = 'core::Material';
const CORE_TRANSFORM = 'core::Transform';
const CORE_SYNC_COMPONENTS = 'core::SyncComponents';

// Asset-packs component names (from ComponentName enum, resolved at runtime)
const ASSET_PACKS_ACTIONS_BASE = 'asset-packs::Actions';
const ASSET_PACKS_TRIGGERS_BASE = 'asset-packs::Triggers';
const ASSET_PACKS_STATES_BASE = 'asset-packs::States';
const ASSET_PACKS_COUNTER_BASE = 'asset-packs::Counter';
const ASSET_PACKS_PLACEHOLDER_BASE = 'asset-packs::Placeholder';
const ASSET_PACKS_SCRIPT_BASE = 'asset-packs::Script';

// Prefix for editor-only components that must be skipped at runtime
const EDITOR_ONLY_PREFIX = 'inspector::';

/** Self-reference sentinel value used in composite.json */
function isSelfRef(value: any): boolean {
  return `${value}` === '{self}';
}

/**
 * Resolves `{self}` string references to the given entity ID (numeric),
 * recursively applied to objects and arrays.
 */
function resolveSelfReferences(obj: any, entityId: Entity): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' && isSelfRef(obj)) return entityId;
  if (Array.isArray(obj)) return obj.map((item: any) => resolveSelfReferences(item, entityId));
  if (typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveSelfReferences(value, entityId);
    }
    return resolved;
  }
  return obj;
}

/** Resolve `{assetPath}` placeholder in a texture's src field */
function parseTexture(basePath: string, texture?: TextureUnion, entityId?: number): TextureUnion | undefined {
  if (!texture) return texture;

  if (texture.tex?.$case === 'texture') {
    return {
      tex: {
        $case: 'texture',
        texture: {
          ...texture.tex.texture,
          src: texture.tex.texture.src.replace('{assetPath}', basePath),
        },
      },
    };
  }

  if (texture.tex?.$case === 'videoTexture' && entityId !== undefined) {
    const videoPlayerEntity = texture.tex.videoTexture.videoPlayerEntity;
    if (isSelfRef(videoPlayerEntity)) {
      return {
        tex: {
          $case: 'videoTexture',
          videoTexture: {
            ...texture.tex.videoTexture,
            videoPlayerEntity: entityId,
          },
        },
      };
    }
  }

  return texture;
}

/** Resolve `{assetPath}` placeholders within a material component */
function parseMaterial(basePath: string, material: PBMaterial, entityId?: number): PBMaterial {
  switch (material.material?.$case) {
    case 'unlit':
      return {
        material: {
          $case: 'unlit',
          unlit: {
            ...material.material.unlit,
            texture: parseTexture(basePath, material.material.unlit.texture, entityId),
          },
        },
      };
    case 'pbr':
      return {
        material: {
          $case: 'pbr',
          pbr: {
            ...material.material.pbr,
            texture: parseTexture(basePath, material.material.pbr.texture, entityId),
            alphaTexture: parseTexture(basePath, material.material.pbr.alphaTexture, entityId),
            bumpTexture: parseTexture(basePath, material.material.pbr.bumpTexture, entityId),
            emissiveTexture: parseTexture(basePath, material.material.pbr.emissiveTexture, entityId),
          },
        },
      };
    default:
      return material;
  }
}

/** Resolve component IDs from SyncComponents component names */
function parseSyncComponents(engine: IEngine, componentNames: string[]): number[] {
  return componentNames.reduce((acc: number[], name: string) => {
    try {
      const component = engine.getComponent(name);
      return [...acc, component.componentId];
    } catch {
      console.error(`spawnCustomItem: SyncComponents references unknown component "${name}"`);
      return acc;
    }
  }, []);
}

/** Options for spawning a custom item */
export type SpawnCustomItemOptions = {
  /** World position for the root entity. Defaults to origin (0,0,0). */
  position?: Vector3Type;
  /** World rotation for the root entity. Defaults to identity quaternion. */
  rotation?: QuaternionType;
  /** Scale for the root entity. Defaults to (1,1,1). */
  scale?: Vector3Type;
  /** Parent entity. Defaults to engine.RootEntity. */
  parent?: Entity;
  /** SDK helpers for network synchronization (syncEntity). */
  sdkHelpers?: ISDKHelpers;
};

/**
 * Spawn a Custom Item entity tree from a composite definition at runtime.
 *
 * Custom Items are stored in the scene project's `custom/<slug>/` directory.
 * Each item has a `composite.json` that defines the entity tree and component
 * data, with `{assetPath}` placeholder for asset paths.
 *
 * @example
 * ```ts
 * import monsterComposite from './custom/monster/composite.json'
 *
 * const entity = spawnCustomItem(engine, monsterComposite, 'custom/monster', {
 *   position: { x: 4, y: 0, z: 4 },
 * })
 * ```
 *
 * @param engine - The ECS engine instance
 * @param composite - The composite definition (import from composite.json)
 * @param basePath - Path prefix that replaces `{assetPath}` in asset references
 *                   (e.g. `'custom/monster'`)
 * @param options - Spawn options: position, rotation, scale, parent, sdkHelpers
 * @returns The root entity of the spawned item tree
 */
export function spawnCustomItem(
  engine: IEngine,
  composite: AssetComposite,
  basePath: string,
  options?: SpawnCustomItemOptions,
): Entity {
  const {
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0, w: 1 },
    scale = { x: 1, y: 1, z: 1 },
    parent,
    sdkHelpers,
  } = options ?? {};

  const Transform = DefineTransform(engine);
  const Name = DefineName(engine);
  const { SyncComponents: SyncComponentsComponent } = getExplorerComponents(engine);

  const parentEntity = parent ?? engine.RootEntity;

  // ── Step 1: Collect entity IDs and build hierarchy maps ──────────────────

  const entityIds = new Set<Entity>();
  const parentOf = new Map<Entity, Entity>(); // composite entityId → composite parentId
  const transformValues = new Map<Entity, any>();
  const names = new Map<Entity, string>();

  const transformComponent = composite.components.find(c => c.name === CORE_TRANSFORM);
  if (transformComponent) {
    for (const [entityIdStr, transformData] of Object.entries(transformComponent.data)) {
      const entityId = Number(entityIdStr) as Entity;
      entityIds.add(entityId);
      transformValues.set(entityId, transformData.json);
      if (typeof transformData.json.parent === 'number') {
        parentOf.set(entityId, transformData.json.parent as Entity);
        entityIds.add(transformData.json.parent as Entity);
      }
    }
  }

  // Collect names
  const nameComponentData = composite.components.find(c => c.name === 'core::Name');
  if (nameComponentData) {
    for (const [entityIdStr, nameData] of Object.entries(nameComponentData.data)) {
      names.set(Number(entityIdStr) as Entity, nameData.json.value);
    }
  }

  // Collect all entity IDs referenced in any component
  for (const component of composite.components) {
    for (const idStr of Object.keys(component.data)) {
      entityIds.add(Number(idStr) as Entity);
    }
  }

  // ── Step 2: Find root entities (no parent in composite) ──────────────────

  const roots = new Set<Entity>();
  for (const entityId of entityIds) {
    if (!parentOf.has(entityId)) {
      roots.add(entityId);
    }
  }

  if (roots.size === 0) {
    throw new Error('spawnCustomItem: No root entities found in composite');
  }

  // ── Step 3: Create engine entities ───────────────────────────────────────

  /** Map from composite entity ID → live engine entity */
  const entities = new Map<Entity, Entity>();

  let mainEntity: Entity;

  if (entityIds.size === 1) {
    // Single-entity composite: the entity itself is the root
    const compositeId = entityIds.values().next().value as Entity;
    const entity = engine.addEntity();
    const entityName = names.get(compositeId) ?? 'custom_item';
    Name.createOrReplace(entity, { value: entityName });
    Transform.createOrReplace(entity, { parent: parentEntity, position, rotation, scale });
    entities.set(compositeId, entity);
    mainEntity = entity;
  } else {
    let defaultParent = parentEntity;

    if (roots.size > 1) {
      // Multiple roots: create a synthetic wrapper entity
      mainEntity = engine.addEntity();
      Name.createOrReplace(mainEntity, { value: 'custom_item_root' });
      Transform.createOrReplace(mainEntity, { parent: parentEntity, position, rotation, scale });
      defaultParent = mainEntity;
    } else {
      // Placeholder; will be set when single root entity is created
      mainEntity = engine.addEntity(); // temp, overwritten below
    }

    // Track orphaned entities that reference a parent not yet created
    const orphanedEntities = new Map<Entity, Entity>(); // compositeId → compositeParentId

    // Create entities in composite order
    for (const entityId of entityIds) {
      if (roots.size === 1 && roots.has(entityId)) {
        // For single-root multi-entity composites, use mainEntity slot
        const entity = engine.addEntity();
        const entityName = names.get(entityId) ?? 'custom_item';
        Name.createOrReplace(entity, { value: entityName });
        Transform.createOrReplace(entity, { parent: parentEntity, position, rotation, scale });
        entities.set(entityId, entity);
        mainEntity = entity;
        continue;
      }

      const isRoot = roots.has(entityId);
      const intendedParentCompositeId = parentOf.get(entityId);
      const resolvedParentEntity = isRoot
        ? defaultParent
        : typeof intendedParentCompositeId === 'number'
          ? entities.get(intendedParentCompositeId)
          : undefined;

      // Detect forward references (parent not yet created)
      if (!isRoot && typeof intendedParentCompositeId === 'number' && resolvedParentEntity === undefined) {
        orphanedEntities.set(entityId, intendedParentCompositeId);
      }

      const entity = engine.addEntity();
      const entityName = names.get(entityId) ?? `custom_item_${entityId}`;
      Name.createOrReplace(entity, { value: entityName });

      const tvRaw = transformValues.get(entityId);
      if (tvRaw && !isRoot) {
        // Non-root entities: use composite transform values relative to parent
        Transform.createOrReplace(entity, {
          parent: resolvedParentEntity ?? defaultParent,
          position: tvRaw.position ?? { x: 0, y: 0, z: 0 },
          rotation: tvRaw.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tvRaw.scale ?? { x: 1, y: 1, z: 1 },
        });
      } else if (isRoot) {
        // Root entities in multi-root scenario get positioned under wrapper
        Transform.createOrReplace(entity, {
          parent: defaultParent,
          position: tvRaw?.position ?? { x: 0, y: 0, z: 0 },
          rotation: tvRaw?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tvRaw?.scale ?? { x: 1, y: 1, z: 1 },
        });
      } else {
        Transform.createOrReplace(entity, { parent: resolvedParentEntity ?? defaultParent });
      }

      entities.set(entityId, entity);
    }

    // Second pass: reparent orphaned entities now that all entities exist
    for (const [orphanCompositeId, parentCompositeId] of orphanedEntities) {
      const entity = entities.get(orphanCompositeId)!;
      const resolvedParent = entities.get(parentCompositeId);
      if (entity && resolvedParent) {
        const tvRaw = transformValues.get(orphanCompositeId);
        Transform.createOrReplace(entity, {
          parent: resolvedParent,
          position: tvRaw?.position ?? { x: 0, y: 0, z: 0 },
          rotation: tvRaw?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tvRaw?.scale ?? { x: 1, y: 1, z: 1 },
        });
      } else {
        console.error(
          `spawnCustomItem: Could not reparent entity ${orphanCompositeId}: parent ${parentCompositeId} not found`,
        );
      }
    }
  }

  // ── Step 4: Pre-pass — assign fresh IDs for COMPONENTS_WITH_ID ───────────
  // Key format: "<componentName>:<compositeEntityId>"
  const ids = new Map<string, number>();
  for (const component of composite.components) {
    if (!COMPONENTS_WITH_ID.includes(component.name)) continue;
    for (const [entityIdStr, data] of Object.entries(component.data)) {
      const key = `${component.name}:${entityIdStr}`;
      if (typeof data.json.id === 'string' && data.json.id.startsWith('{self')) {
        ids.set(key, getNextId(engine));
      }
    }
  }

  // Resolve cross-entity and self-entity ID references from composite templates
  const mapId = (id: string | number, entityIdStr: string): number | string | undefined => {
    if (typeof id !== 'string') return id;

    // {self:ComponentName} → ID generated for this entity's component
    const selfMatch = id.match(/^\{self:(.+)\}$/);
    if (selfMatch) {
      const key = `${selfMatch[1]}:${entityIdStr}`;
      return ids.get(key);
    }

    // {N:ComponentName} → ID generated for entity N's component
    const crossMatch = id.match(/^\{(\d+):(.+)\}$/);
    if (crossMatch) {
      const [, refEntityId, componentName] = crossMatch;
      const key = `${componentName}:${refEntityId}`;
      return ids.get(key);
    }

    return id;
  };

  // ── Step 5: Apply components to each entity ───────────────────────────────

  for (const component of composite.components) {
    const componentName = component.name;

    // Skip Transform and Name — already applied during entity creation
    if (componentName === CORE_TRANSFORM || componentName === 'core::Name') continue;

    // Skip editor-only components (inspector::*)
    if (componentName.startsWith(EDITOR_ONLY_PREFIX)) continue;

    for (const [entityIdStr, rawData] of Object.entries(component.data)) {
      const compositeEntityId = Number(entityIdStr) as Entity;
      const targetEntity = entities.get(compositeEntityId);
      if (!targetEntity) continue;

      const key = `${componentName}:${entityIdStr}`;
      let componentValue = { ...rawData.json };

      // Restore the pre-assigned ID if this is a COMPONENTS_WITH_ID entry
      if (COMPONENTS_WITH_ID.includes(componentName) && ids.has(key)) {
        componentValue = { ...componentValue, id: ids.get(key) };
      }

      try {
        switch (componentName) {
          // ── GltfContainer: replace {assetPath} in src ──
          case CORE_GLTF_CONTAINER: {
            componentValue.visibleMeshesCollisionMask ??= 0;
            componentValue.invisibleMeshesCollisionMask ??= 3;
            componentValue.src = componentValue.src.replace('{assetPath}', basePath);
            break;
          }

          // ── AudioSource: replace {assetPath} in audioClipUrl ──
          case CORE_AUDIO_SOURCE: {
            if (componentValue.audioClipUrl) {
              componentValue.audioClipUrl = componentValue.audioClipUrl.replace('{assetPath}', basePath);
            }
            break;
          }

          // ── VideoPlayer: replace {assetPath} in src ──
          case CORE_VIDEO_PLAYER: {
            if (componentValue.src) {
              componentValue.src = componentValue.src.replace('{assetPath}', basePath);
            }
            break;
          }

          // ── Material: replace {assetPath} in nested texture srcs ──
          case CORE_MATERIAL: {
            componentValue = parseMaterial(basePath, componentValue as PBMaterial, targetEntity);
            break;
          }

          // ── GltfNodeModifiers: replace {assetPath} in modifier materials ──
          case CORE_GLTF_NODE_MODIFIERS: {
            if (Array.isArray(componentValue.modifiers)) {
              componentValue.modifiers = componentValue.modifiers.map((modifier: any) => ({
                ...modifier,
                material: modifier.material
                  ? parseMaterial(basePath, modifier.material, targetEntity)
                  : undefined,
              }));
            }
            break;
          }

          // ── Placeholder: replace {assetPath} in src ──
          default:
            if (componentName.startsWith(ASSET_PACKS_PLACEHOLDER_BASE)) {
              if (componentValue.src) {
                componentValue.src = componentValue.src.replace('{assetPath}', basePath);
              }
            }
            // ── Script: replace {assetPath} in each script item path ──
            else if (componentName.startsWith(ASSET_PACKS_SCRIPT_BASE)) {
              if (Array.isArray(componentValue.value)) {
                componentValue.value = componentValue.value.map((scriptItem: any) => ({
                  ...scriptItem,
                  path: scriptItem.path?.replace('{assetPath}', basePath) ?? scriptItem.path,
                }));
              }
            }
            // ── Actions: replace {assetPath} in audio/emote/image payloads ──
            else if (componentName.startsWith(ASSET_PACKS_ACTIONS_BASE)) {
              if (Array.isArray(componentValue.value)) {
                const newActions: any[] = [];
                for (const action of componentValue.value) {
                  switch (action.type) {
                    case ActionType.PLAY_SOUND: {
                      const payload = getPayload<ActionType.PLAY_SOUND>(action);
                      newActions.push({
                        ...action,
                        jsonPayload: getJson<ActionType.PLAY_SOUND>({
                          ...payload,
                          src: payload.src?.replace('{assetPath}', basePath) ?? payload.src,
                        }),
                      });
                      break;
                    }
                    case ActionType.PLAY_CUSTOM_EMOTE: {
                      const payload = getPayload<ActionType.PLAY_CUSTOM_EMOTE>(action);
                      newActions.push({
                        ...action,
                        jsonPayload: getJson<ActionType.PLAY_CUSTOM_EMOTE>({
                          ...payload,
                          src: payload.src?.replace('{assetPath}', basePath) ?? payload.src,
                        }),
                      });
                      break;
                    }
                    case ActionType.SHOW_IMAGE: {
                      const payload = getPayload<ActionType.SHOW_IMAGE>(action);
                      newActions.push({
                        ...action,
                        jsonPayload: getJson<ActionType.SHOW_IMAGE>({
                          ...payload,
                          src: payload.src?.replace('{assetPath}', basePath) ?? payload.src,
                        }),
                      });
                      break;
                    }
                    case ActionType.CHANGE_CAMERA: {
                      try {
                        const payload = getPayload<ActionType.CHANGE_CAMERA>(action);
                        const resolvedPayload = resolveSelfReferences(payload, targetEntity);
                        newActions.push({
                          ...action,
                          jsonPayload: getJson<ActionType.CHANGE_CAMERA>(resolvedPayload),
                        });
                      } catch (err) {
                        console.error('spawnCustomItem: Failed to parse CHANGE_CAMERA payload:', err);
                        newActions.push(action);
                      }
                      break;
                    }
                    default:
                      newActions.push(action);
                  }
                }
                componentValue = { ...componentValue, value: newActions };
              }
            }
            // ── Triggers: remap condition and action IDs ──
            else if (componentName.startsWith(ASSET_PACKS_TRIGGERS_BASE)) {
              if (Array.isArray(componentValue.value)) {
                componentValue.value = componentValue.value.map((trigger: any) => ({
                  ...trigger,
                  conditions: (trigger.conditions ?? []).map((condition: any) => ({
                    ...condition,
                    id: mapId(condition.id, entityIdStr),
                  })),
                  actions: trigger.actions.map((action: any) => ({
                    ...action,
                    id: mapId(action.id, entityIdStr),
                  })),
                }));
              }
            }
            break;
        }

        // ── SyncComponents: wire network sync via sdkHelpers ──────────────
        if (componentName === CORE_SYNC_COMPONENTS) {
          const componentIds = parseSyncComponents(
            engine,
            componentValue.value ?? componentValue.componentIds ?? [],
          );
          // Store the resolved componentIds on the entity
          SyncComponentsComponent.createOrReplace(targetEntity, { componentIds });
          if (sdkHelpers?.syncEntity) {
            sdkHelpers.syncEntity(targetEntity, componentIds);
          }
          continue; // Already handled above
        }

        // Apply component to entity (generic path for all other components)
        const Component = engine.getComponent(componentName) as LastWriteWinElementSetComponentDefinition<unknown>;
        Component.createOrReplace(targetEntity, componentValue);
      } catch (err) {
        // Unknown components (e.g. editor-only that slipped through) are skipped silently
        console.error(
          `spawnCustomItem: Failed to create component "${componentName}" on entity ${targetEntity}:`,
          err,
        );
      }
    }
  }

  return mainEntity!;
}

/**
 * Remove all entities that were spawned as part of a Custom Item tree.
 *
 * Unlike `engine.removeEntity`, this walks the full Transform-parented
 * entity tree and removes every entity in it.
 *
 * @param engine - The ECS engine instance
 * @param entity - The root entity returned by `spawnCustomItem`
 */
export function despawnCustomItem(engine: IEngine, entity: Entity): void {
  const Transform = DefineTransform(engine);
  const tree = getComponentEntityTree(engine, entity, Transform);
  for (const e of tree) {
    engine.removeEntity(e);
  }
}
