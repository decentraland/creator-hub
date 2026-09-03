import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  QuaternionType,
  TransformComponentExtended,
  Vector3Type,
} from '@dcl/ecs';
import type { AssetComposite, ISDKHelpers, TriggersComponent } from './definitions';
import { ActionType, ComponentName } from './enums';
import { getJson, getPayload } from './action-types';
import { COMPONENTS_WITH_ID, getNextId } from './id';
import { isLastWriteWinComponent } from './lww';

// Core component name constants — mirrors CoreComponents in inspector/src/lib/sdk/components/types.ts
const CORE_TRANSFORM = 'core::Transform';
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_AUDIO_SOURCE = 'core::AudioSource';
const CORE_VIDEO_PLAYER = 'core::VideoPlayer';
const CORE_MATERIAL = 'core::Material';
const CORE_SYNC_COMPONENTS = 'core-schema::Sync-Components';
const CORE_NAME = 'core-schema::Name';
const CORE_GLTF_NODE_MODIFIERS = 'core::GltfNodeModifiers';

/**
 * Options for `spawnCustomItem`.
 */
export type SpawnCustomItemOptions = {
  /** Parent entity for the spawned tree. Defaults to `engine.RootEntity`. */
  parent?: Entity;
  /** World position of the root entity. Defaults to `{x:0, y:0, z:0}`. */
  position?: Vector3Type;
  /** Rotation of the root entity. Defaults to identity `{x:0, y:0, z:0, w:1}`. */
  rotation?: QuaternionType;
  /** Scale of the root entity. Defaults to `{x:1, y:1, z:1}`. */
  scale?: Vector3Type;
  /**
   * Base path used to replace `{assetPath}` placeholders in asset references
   * (GLTF sources, audio clips, video sources, textures, action payloads, scripts).
   *
   * Typically this is the directory where the custom item's assets are deployed,
   * e.g. `'assets/custom/my-monster-slug'`.
   *
   * If not provided, `{assetPath}` placeholders are left unreplaced and asset
   * references will be broken. Always pass this when the composite contains
   * asset references.
   */
  basePath?: string;
};

// ---------------------------------------------------------------------------
// Internal helpers (mirrors inspector/src/lib/sdk/operations/add-asset/utils.ts)
// ---------------------------------------------------------------------------

function replaceAssetPath(value: string, basePath: string): string {
  return value.replace('{assetPath}', basePath);
}

function parseTexture(basePath: string, texture: any, entityId: number): any {
  if (!texture) return texture;

  if (texture?.tex?.$case === 'texture') {
    return {
      tex: {
        $case: 'texture',
        texture: {
          ...texture.tex.texture,
          src: replaceAssetPath(texture.tex.texture.src, basePath),
        },
      },
    };
  }

  if (texture?.tex?.$case === 'videoTexture') {
    const videoPlayerEntity = texture.tex.videoTexture.videoPlayerEntity;
    if (`${videoPlayerEntity}` === '{self}') {
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

function parseMaterial(basePath: string, material: any, entityId: number): any {
  switch (material?.material?.$case) {
    case 'unlit':
      return {
        ...material,
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
        ...material,
        material: {
          $case: 'pbr',
          pbr: {
            ...material.material.pbr,
            texture: parseTexture(basePath, material.material.pbr.texture, entityId),
            alphaTexture: parseTexture(basePath, material.material.pbr.alphaTexture, entityId),
            bumpTexture: parseTexture(basePath, material.material.pbr.bumpTexture, entityId),
            emissiveTexture: parseTexture(
              basePath,
              material.material.pbr.emissiveTexture,
              entityId,
            ),
          },
        },
      };
    default:
      return material;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Instantiates a Custom Item composite as a live entity tree in the engine.
 *
 * This is the runtime counterpart of the editor's `addAsset()` operation.
 * Use it from scene code to dynamically spawn entities defined as Custom Items
 * (for example, to implement a wave spawner for a "monster" Custom Item).
 *
 * The composite JSON is typically deployed alongside scene files and can be
 * fetched at runtime:
 *
 * ```typescript
 * const composite: AssetComposite = await fetch(
 *   'assets/custom/my-monster/composite.json'
 * ).then(r => r.json());
 *
 * const root = spawnCustomItem(engine, composite, Transform, Triggers, sdkHelpers, {
 *   parent: engine.RootEntity,
 *   position: { x: 4, y: 0, z: 4 },
 *   basePath: 'assets/custom/my-monster',
 * });
 * ```
 *
 * @param engine      - The ECS engine instance.
 * @param composite   - The `AssetComposite` definition (e.g. from `composite.json`).
 * @param Transform   - The `Transform` component obtained from the engine.
 * @param Triggers    - The `Triggers` component obtained from the engine.
 * @param sdkHelpers  - Optional SDK helpers. Required for SyncComponents/NetworkEntity support.
 * @param options     - Spawn options: parent, position, rotation, scale, basePath.
 * @returns The root entity of the spawned entity tree.
 * @throws If the composite contains no entities.
 */
export function spawnCustomItem(
  engine: IEngine,
  composite: AssetComposite,
  Transform: TransformComponentExtended,
  _Triggers: TriggersComponent,
  sdkHelpers?: ISDKHelpers,
  options?: SpawnCustomItemOptions,
): Entity {
  const parent = options?.parent ?? engine.RootEntity;
  const position = options?.position ?? { x: 0, y: 0, z: 0 };
  const rotation = options?.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const scale = options?.scale ?? { x: 1, y: 1, z: 1 };
  const basePath = options?.basePath ?? '';

  // Map from composite entity ID → live ECS entity
  const entities = new Map<Entity, Entity>();

  // Map from composite entity ID → its parent composite entity ID
  const parentOf = new Map<Entity, Entity>();

  // -------------------------------------------------------------------------
  // Step 1: Parse Transform tree to build parent relationships
  // -------------------------------------------------------------------------
  const transformComponent = composite.components.find(c => c.name === CORE_TRANSFORM);
  const entityIds = new Set<Entity>();

  if (transformComponent) {
    for (const [entityIdStr, transformData] of Object.entries(transformComponent.data)) {
      const entity = Number(entityIdStr) as Entity;
      entityIds.add(entity);
      const parentId = (transformData as any).json.parent;
      if (typeof parentId === 'number') {
        parentOf.set(entity, parentId as Entity);
        entityIds.add(parentId as Entity);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Collect all entity IDs from every component
  // -------------------------------------------------------------------------
  for (const component of composite.components) {
    for (const id of Object.keys(component.data)) {
      entityIds.add(Number(id) as Entity);
    }
  }

  if (entityIds.size === 0) {
    throw new Error('[spawnCustomItem] Composite contains no entities');
  }

  // -------------------------------------------------------------------------
  // Step 3: Parse entity names
  // -------------------------------------------------------------------------
  const names = new Map<Entity, string>();
  const nameComponent = composite.components.find(c => c.name === CORE_NAME);
  if (nameComponent) {
    for (const [entityIdStr, nameData] of Object.entries(nameComponent.data)) {
      names.set(Number(entityIdStr) as Entity, (nameData as any).json.value as string);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Identify root entities (those with no parent in the composite)
  // -------------------------------------------------------------------------
  const roots = new Set<Entity>();
  for (const entityId of entityIds) {
    if (!parentOf.has(entityId)) {
      roots.add(entityId);
    }
  }

  if (roots.size === 0) {
    throw new Error('[spawnCustomItem] No root entities found in composite');
  }

  // -------------------------------------------------------------------------
  // Step 5: Parse stored Transform values
  // -------------------------------------------------------------------------
  const transformValues = new Map<Entity, any>();
  if (transformComponent) {
    for (const [entityIdStr, transformData] of Object.entries(transformComponent.data)) {
      transformValues.set(Number(entityIdStr) as Entity, (transformData as any).json);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Create entities
  // -------------------------------------------------------------------------
  let mainEntity: Entity | null = null;
  let defaultParent = parent;

  // If multiple roots, create a synthetic wrapper entity
  if (roots.size > 1) {
    const wrapper = engine.addEntity();
    Transform.createOrReplace(wrapper, { parent, position, rotation, scale });
    mainEntity = wrapper;
    defaultParent = wrapper;
  }

  if (entityIds.size === 1) {
    // Single-entity composite
    const singleId = entityIds.values().next().value as Entity;
    const entity = engine.addEntity();
    Transform.createOrReplace(entity, { parent, position, rotation, scale });
    entities.set(singleId, entity);
    mainEntity = entity;
  } else {
    // Multi-entity composite — create all, track orphans for reparenting
    const orphanedEntities = new Map<Entity, Entity>();

    for (const entityId of entityIds) {
      const isRoot = roots.has(entityId);
      const intendedParentId = parentOf.get(entityId);
      const parentEntity = isRoot
        ? defaultParent
        : typeof intendedParentId === 'number'
          ? entities.get(intendedParentId)
          : undefined;

      if (!isRoot && typeof intendedParentId === 'number' && parentEntity === undefined) {
        orphanedEntities.set(entityId, intendedParentId);
      }

      const entity = engine.addEntity();
      const resolvedParent = parentEntity ?? defaultParent;

      if (isRoot) {
        // Apply caller-specified transform to root entities
        Transform.createOrReplace(entity, { parent: resolvedParent, position, rotation, scale });
      } else {
        const tv = transformValues.get(entityId);
        Transform.createOrReplace(entity, {
          parent: resolvedParent,
          position: tv?.position ?? { x: 0, y: 0, z: 0 },
          rotation: tv?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tv?.scale ?? { x: 1, y: 1, z: 1 },
        });
      }

      entities.set(entityId, entity);
    }

    // Reparent orphaned entities now that all have been created
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
          `[spawnCustomItem] Failed to reparent entity ${entityId}: ` +
            `parent ${intendedParentId} not found`,
        );
      }
    }

    // Single-root composite: promote the root entity to main
    if (roots.size === 1) {
      const root = Array.from(roots)[0];
      mainEntity = entities.get(root)!;
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Pre-generate IDs for COMPONENTS_WITH_ID (Actions, States, Counter)
  //         Must happen BEFORE the component-application loop so that
  //         {self:ComponentName} references in Triggers can be resolved.
  // -------------------------------------------------------------------------
  const ids = new Map<string, number>();
  const values = new Map<string, any>();

  for (const component of composite.components) {
    const componentName = component.name;
    for (const [entityIdStr, data] of Object.entries(component.data)) {
      const key = `${componentName}:${entityIdStr}`;
      const componentValue = { ...(data as any).json };
      if (COMPONENTS_WITH_ID.includes(componentName) && `${componentValue.id}` === '{self}') {
        const newId = getNextId(engine);
        ids.set(key, newId);
        componentValue.id = newId;
      }
      values.set(key, componentValue);
    }
  }

  // Resolve {self:ComponentName} and {N:ComponentName} ID references
  const mapId = (id: string | number, entityIdStr: string): number | string => {
    if (typeof id === 'string') {
      const selfMatch = id.match(/\{self:(.+)\}/);
      if (selfMatch) {
        const key = `${selfMatch[1]}:${entityIdStr}`;
        return ids.get(key) ?? id;
      }
      const crossMatch = id.match(/\{(\d+):(.+)\}/);
      if (crossMatch) {
        const key = `${crossMatch[2]}:${crossMatch[1]}`;
        return ids.get(key) ?? id;
      }
    }
    return id;
  };

  // -------------------------------------------------------------------------
  // Step 8: Apply components to each entity
  // -------------------------------------------------------------------------
  for (const component of composite.components) {
    const componentName = component.name;

    for (const [entityIdStr] of Object.entries(component.data)) {
      const entityId = Number(entityIdStr) as Entity;
      const targetEntity = entities.get(entityId);

      if (!targetEntity) continue;

      // Transform and Name are already applied during entity creation — skip
      if (componentName === CORE_TRANSFORM || componentName === CORE_NAME) continue;

      const key = `${componentName}:${entityIdStr}`;
      let componentValue = values.get(key);

      switch (componentName) {
        case CORE_GLTF_CONTAINER: {
          componentValue = {
            visibleMeshesCollisionMask: 0,
            invisibleMeshesCollisionMask: 3,
            ...componentValue,
          };
          if (basePath && componentValue.src?.includes('{assetPath}')) {
            componentValue = {
              ...componentValue,
              src: replaceAssetPath(componentValue.src, basePath),
            };
          }
          break;
        }

        case ComponentName.PLACEHOLDER: {
          if (basePath && componentValue.src?.includes('{assetPath}')) {
            componentValue = {
              ...componentValue,
              src: replaceAssetPath(componentValue.src, basePath),
            };
          }
          break;
        }

        case CORE_GLTF_NODE_MODIFIERS: {
          if (basePath) {
            componentValue = {
              ...componentValue,
              modifiers: (componentValue.modifiers ?? []).map((modifier: any) => ({
                ...modifier,
                material: parseMaterial(basePath, modifier.material, targetEntity),
              })),
            };
          }
          break;
        }

        case CORE_AUDIO_SOURCE: {
          if (basePath && componentValue.audioClipUrl?.includes('{assetPath}')) {
            componentValue = {
              ...componentValue,
              audioClipUrl: replaceAssetPath(componentValue.audioClipUrl, basePath),
            };
          }
          break;
        }

        case CORE_VIDEO_PLAYER: {
          if (basePath && componentValue.src?.includes('{assetPath}')) {
            componentValue = {
              ...componentValue,
              src: replaceAssetPath(componentValue.src, basePath),
            };
          }
          break;
        }

        case CORE_MATERIAL: {
          if (basePath) {
            componentValue = parseMaterial(basePath, componentValue, targetEntity);
          }
          break;
        }

        case ComponentName.ACTIONS: {
          const newActions: any[] = [];
          for (const action of componentValue.value ?? []) {
            switch (action.type) {
              case ActionType.PLAY_SOUND: {
                const payload = getPayload<ActionType.PLAY_SOUND>(action);
                newActions.push(
                  basePath && payload.src?.includes('{assetPath}')
                    ? {
                        ...action,
                        jsonPayload: getJson<ActionType.PLAY_SOUND>({
                          ...payload,
                          src: replaceAssetPath(payload.src, basePath),
                        }),
                      }
                    : action,
                );
                break;
              }
              case ActionType.PLAY_CUSTOM_EMOTE: {
                const payload = getPayload<ActionType.PLAY_CUSTOM_EMOTE>(action);
                newActions.push(
                  basePath && payload.src?.includes('{assetPath}')
                    ? {
                        ...action,
                        jsonPayload: getJson<ActionType.PLAY_CUSTOM_EMOTE>({
                          ...payload,
                          src: replaceAssetPath(payload.src, basePath),
                        }),
                      }
                    : action,
                );
                break;
              }
              case ActionType.SHOW_IMAGE: {
                const payload = getPayload<ActionType.SHOW_IMAGE>(action);
                newActions.push(
                  basePath && payload.src?.includes('{assetPath}')
                    ? {
                        ...action,
                        jsonPayload: getJson<ActionType.SHOW_IMAGE>({
                          ...payload,
                          src: replaceAssetPath(payload.src, basePath),
                        }),
                      }
                    : action,
                );
                break;
              }
              default:
                newActions.push(action);
                break;
            }
          }
          componentValue = { ...componentValue, value: newActions };
          break;
        }

        case ComponentName.TRIGGERS: {
          const newTriggers = (componentValue.value ?? []).map((trigger: any) => ({
            ...trigger,
            conditions: (trigger.conditions ?? []).map((condition: any) => ({
              ...condition,
              id: mapId(condition.id, entityIdStr),
            })),
            actions: (trigger.actions ?? []).map((action: any) => ({
              ...action,
              id: mapId(action.id, entityIdStr),
            })),
          }));
          componentValue = { ...componentValue, value: newTriggers };
          break;
        }

        case CORE_SYNC_COMPONENTS: {
          const componentNames: string[] =
            componentValue.value ?? componentValue.componentIds ?? [];
          const componentIds = componentNames.reduce((acc: number[], name: string) => {
            try {
              return [...acc, engine.getComponent(name).componentId];
            } catch (_e) {
              console.error(`[spawnCustomItem] Component "${name}" does not exist in engine`);
              return acc;
            }
          }, []);

          if (sdkHelpers?.syncEntity) {
            sdkHelpers.syncEntity(targetEntity, componentIds);
          } else {
            console.error(
              '[spawnCustomItem] SyncComponents found but sdkHelpers.syncEntity is not provided. ' +
                'This entity will not be synchronized in multiplayer.',
            );
          }
          // syncEntity handles network registration — skip generic createOrReplace
          continue;
        }

        case ComponentName.SCRIPT: {
          if (basePath) {
            const newScripts = (componentValue.value ?? []).map((scriptItem: any) => ({
              ...scriptItem,
              path: scriptItem.path?.includes('{assetPath}')
                ? replaceAssetPath(scriptItem.path, basePath)
                : scriptItem.path,
            }));
            componentValue = { ...componentValue, value: newScripts };
          }
          break;
        }

        default:
          break;
      }

      // Apply the component using createOrReplace; catch unknown components gracefully
      try {
        const Component = engine.getComponent(
          componentName,
        ) as LastWriteWinElementSetComponentDefinition<unknown>;
        if (isLastWriteWinComponent(Component)) {
          Component.createOrReplace(targetEntity, componentValue);
        }
      } catch (_error) {
        console.error(
          `[spawnCustomItem] Failed to apply component "${componentName}" ` +
            `to entity ${targetEntity}:`,
          _error,
        );
      }
    }
  }

  if (!mainEntity) {
    throw new Error('[spawnCustomItem] Failed to resolve main entity');
  }

  return mainEntity;
}
