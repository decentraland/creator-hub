import type {
  Composite,
  Entity,
  IEngine,
  Vector3Type,
  LastWriteWinElementSetComponentDefinition,
  TransformType,
} from '@dcl/ecs';
import {
  Transform as TransformEngine,
  GltfContainer as GltfEngine,
  NetworkEntity as NetworkEntityEngine,
  Name,
  Tags as TagsEngine,
} from '@dcl/ecs';
import type { Actions, AssetComposite } from '@dcl/asset-packs';
import {
  ActionType,
  allocateIdsForSpawnedComponents,
  ComponentName,
  getJson,
  getPayload,
  remapTriggerReferences,
  substituteAssetPathInComposite,
} from '@dcl/asset-packs';

import type { EditorComponents } from '../../components';
import { CoreComponents, EditorComponentNames } from '../../components';
import updateSelectedEntity from '../update-selected-entity';
import { addChild } from '../add-child';
import type { EnumEntity } from '../../enum-entity';
import type { AssetData } from '../../../logic/catalog';
import { pushChild, removeChild } from '../../nodes';
import { ROOT } from '../../tree';
import { parseMaterial, parseSyncComponents, resolveSelfReferences } from './utils';

// The inspector's `AssetComposite` keeps `component.data` as a plain object
// `{ [entityId: string]: { json: T } }`, whereas the asset-packs helpers
// operate on the ts-proto `Composite.Definition` shape with
// `data: Map<Entity, ComponentData>` and
// `ComponentData = { data: { $case: 'json', json: T } }`.
//
// `toProtoComposite` is the single named bridge between the two shapes:
// drift on either side becomes a type error here instead of being hidden by
// a free-floating `as unknown as` at the call site. Inner `json` references
// are shared with the original payloads so mutating-in-place helpers (e.g.
// `substituteAssetPathInComposite`) flow through. `values` carries shallow
// copies so subsequent `.id =` writes don't leak back.
type ProtoComposite = Composite.Definition;
type ComponentValues = Map<string, any>;

function toProtoComposite(source: AssetComposite): {
  composite: ProtoComposite;
  values: ComponentValues;
} {
  const values: ComponentValues = new Map();
  const components: ProtoComposite['components'] = source.components.map(component => {
    const dataMap = new Map<Entity, { data: { $case: 'json'; json: any } }>();
    for (const [entityId, value] of Object.entries(component.data)) {
      dataMap.set(Number(entityId) as Entity, {
        data: { $case: 'json', json: value.json },
      });
      values.set(`${component.name}:${entityId}`, { ...value.json });
    }
    return { name: component.name, jsonSchema: undefined, data: dataMap };
  });
  return {
    composite: { version: source.version, components } as unknown as ProtoComposite,
    values,
  };
}

export function addAsset(engine: IEngine) {
  return function addAsset(
    parent: Entity,
    src: string,
    name: string,
    position: Vector3Type,
    base: string,
    enumEntityId: EnumEntity,
    composite?: AssetData['composite'],
    assetId?: string,
    custom?: boolean,
  ): Entity {
    const Transform = engine.getComponent(TransformEngine.componentId) as typeof TransformEngine;
    const Tags = engine.getComponent(TagsEngine.componentId) as typeof TagsEngine;
    const GltfContainer = engine.getComponent(GltfEngine.componentId) as typeof GltfEngine;
    const NetworkEntity = engine.getComponent(
      NetworkEntityEngine.componentId,
    ) as typeof NetworkEntityEngine;
    const Nodes = engine.getComponent(EditorComponentNames.Nodes) as EditorComponents['Nodes'];
    const CustomAsset = engine.getComponent(
      EditorComponentNames.CustomAsset,
    ) as EditorComponents['CustomAsset'];

    // Normalize position to plain object (fixes serialization issues with BabylonJS Vector3)
    const normalizedPosition: Vector3Type = {
      x: position.x ?? 0,
      y: position.y ?? 0,
      z: position.z ?? 0,
    };

    if (composite) {
      // Get all unique entity IDs from components
      const entityIds = new Set<Entity>();

      // Track all created entities
      const entities = new Map<Entity, Entity>();

      // Tranform tree
      const parentOf = new Map<Entity, Entity>();
      const transformComponent = composite.components.find(
        component => component.name === CoreComponents.TRANSFORM,
      );
      if (transformComponent) {
        for (const [entityId, transformData] of Object.entries(transformComponent.data)) {
          const entity = Number(entityId) as Entity;
          entityIds.add(entity);
          if (typeof transformData.json.parent === 'number') {
            parentOf.set(entity, transformData.json.parent);
            entityIds.add(transformData.json.parent);
          }
        }
      }

      // Store names
      const names = new Map<Entity, string>();
      const nameComponent = composite.components.find(
        component => component.name === Name.componentName,
      );
      if (nameComponent) {
        for (const [entityId, nameData] of Object.entries(nameComponent.data)) {
          names.set(Number(entityId) as Entity, nameData.json.value);
        }
      }

      // Get all entity ids
      for (const component of composite.components) {
        for (const id of Object.keys(component.data)) {
          entityIds.add(Number(id) as Entity);
        }
      }

      // Get all roots
      const roots = new Set<Entity>();
      for (const entityId of entityIds) {
        if (!parentOf.has(entityId)) {
          roots.add(entityId);
        }
      }

      // Store initial transform values
      const transformValues = new Map<Entity, TransformType>();
      if (transformComponent) {
        for (const [entityId, transformData] of Object.entries(transformComponent.data)) {
          const entity = Number(entityId) as Entity;
          transformValues.set(entity, transformData.json);
        }
      }

      if (roots.size === 0) {
        throw new Error('No roots found in composite');
      }
      let defaultParent = parent;
      let mainEntity: Entity | null = null;

      // If multiple roots, create a new root as main entity
      if (roots.size > 1) {
        mainEntity = addChild(engine)(parent, `${name}_root`);
        Transform.createOrReplace(mainEntity, { parent, position: normalizedPosition });
        defaultParent = mainEntity;
      }

      // If single entity, use it as root and main entity
      if (entityIds.size === 1) {
        mainEntity = addChild(engine)(parent, name);
        Transform.createOrReplace(mainEntity, { parent, position: normalizedPosition });
        entities.set(entityIds.values().next().value as Entity, mainEntity);
      } else {
        // Track orphaned entities that need to be reparented
        const orphanedEntities = new Map<Entity, Entity>();

        // Create all entities
        for (const entityId of entityIds) {
          const isRoot = roots.has(entityId);
          const intendedParentId = parentOf.get(entityId);
          const parentEntity = isRoot
            ? defaultParent
            : typeof intendedParentId === 'number'
              ? entities.get(intendedParentId)
              : undefined;

          // If parent doesn't exist yet, temporarily attach to parentForChildren
          if (
            !isRoot &&
            typeof intendedParentId === 'number' &&
            typeof parentEntity === 'undefined'
          ) {
            orphanedEntities.set(entityId, intendedParentId);
          }

          const entity = addChild(engine)(
            parentEntity || defaultParent,
            names.get(entityId) || (entityId === ROOT ? name : `${name}_${entityId}`),
          );

          // Apply transform values from composite
          const transformValue = transformValues.get(entityId);
          if (transformValue) {
            Transform.createOrReplace(entity, {
              position: transformValue.position || { x: 0, y: 0, z: 0 },
              rotation: transformValue.rotation || { x: 0, y: 0, z: 0, w: 1 },
              scale: transformValue.scale || { x: 1, y: 1, z: 1 },
              parent: parentEntity || defaultParent,
            });
          }

          entities.set(entityId, entity);
        }

        // Reparent orphaned entities now that all entities exist
        for (const [entityId, intendedParentId] of orphanedEntities) {
          const entity = entities.get(entityId)!;
          const parentEntity = entities.get(intendedParentId)!;
          if (parentEntity) {
            const transformValue = transformValues.get(entityId);
            Transform.createOrReplace(entity, {
              parent: parentEntity,
              position: transformValue?.position || { x: 0, y: 0, z: 0 },
              rotation: transformValue?.rotation || { x: 0, y: 0, z: 0, w: 1 },
              scale: transformValue?.scale || { x: 1, y: 1, z: 1 },
            });
            Nodes.createOrReplace(engine.RootEntity, {
              value: removeChild(engine, defaultParent, entity),
            });
            Nodes.createOrReplace(engine.RootEntity, {
              value: pushChild(engine, parentEntity, entity),
            });
          } else {
            console.warn(
              `Failed to reparent entity ${entityId}: parent ${intendedParentId} not found`,
            );
          }
        }

        // If multiple entities but single root, use root as main entity
        if (roots.size === 1) {
          const root = Array.from(roots)[0];
          mainEntity = entities.get(root)!;
          Transform.createOrReplace(mainEntity, { parent, position: normalizedPosition });
        }
      }

      const { composite: adaptedComposite, values } = toProtoComposite(composite);

      // Apply {assetPath} substitution across the whole composite in one pass.
      // The recursive walker handles every string-shaped occurrence — including
      // those nested inside Action `jsonPayload` strings. `base` is already the
      // asset directory (no filename); pass a synthetic composite src so the
      // helper's `assetPathFrom` strips back to `base`.
      substituteAssetPathInComposite(adaptedComposite, `${base}/composite.json`);

      // Build the composite-entityId → spawned-Entity mapping the asset-packs
      // helper expects (it walks each composite component and writes IDs onto
      // the live spawned components by entity).
      const spawnedEntityByCompositeId = new Map<number, Entity>();
      for (const [compositeEntityId, destEntity] of entities) {
        spawnedEntityByCompositeId.set(compositeEntityId as number, destEntity);
      }

      const ids = allocateIdsForSpawnedComponents(
        engine,
        adaptedComposite,
        spawnedEntityByCompositeId,
      );

      // `allocateIdsForSpawnedComponents` writes onto live entities AND returns
      // the keyed `ids` map. In the inspector flow the live entities don't yet
      // have these components attached (createOrReplace runs further below), so
      // the on-entity write is a no-op — but the `ids` map is still populated.
      // Copy the allocated ids back into `values` so the per-component switch
      // below picks them up before each `createOrReplace`.
      for (const [key, newId] of ids) {
        const v = values.get(key);
        if (v) v.id = newId;
      }

      // Process and create components for each entity
      for (const component of composite.components) {
        const componentName = component.name;
        for (const [entityIdStr] of Object.entries(component.data)) {
          const entityId = Number(entityIdStr) as Entity;
          const targetEntity = entities.get(entityId)!;
          const key = `${componentName}:${entityIdStr}`;
          let componentValue = values.get(key);

          switch (componentName) {
            case CoreComponents.GLTF_CONTAINER: {
              componentValue.visibleMeshesCollisionMask ??= 0;
              componentValue.invisibleMeshesCollisionMask ??= 3;
              break;
            }
            case CoreComponents.GLTF_NODE_MODIFIERS: {
              componentValue.modifiers = componentValue.modifiers?.map((modifier: any) => ({
                ...modifier,
                material: parseMaterial(base, modifier.material, targetEntity),
              }));
              break;
            }
            case EditorComponentNames.Config: {
              if (assetId) {
                componentValue = { ...componentValue, assetId };
              }
              break;
            }
            case CoreComponents.MATERIAL: {
              componentValue = parseMaterial(base, componentValue, targetEntity);
              break;
            }
            case ComponentName.ACTIONS: {
              const newValue: Actions['value'] = [];
              for (const action of componentValue.value) {
                switch (action.type) {
                  case ActionType.CHANGE_CAMERA: {
                    try {
                      const payload = getPayload<ActionType.CHANGE_CAMERA>(action);
                      const resolvedPayload = resolveSelfReferences(payload, targetEntity);
                      newValue.push({
                        ...action,
                        jsonPayload: getJson<ActionType.CHANGE_CAMERA>(resolvedPayload),
                      });
                    } catch (error) {
                      console.error('Failed to parse CHANGE_CAMERA payload:', error);
                      newValue.push(action);
                    }
                    break;
                  }
                  default:
                    newValue.push(action);
                    break;
                }
              }
              componentValue = { ...componentValue, value: newValue };
              break;
            }
            case CoreComponents.SYNC_COMPONENTS: {
              const componentIds = parseSyncComponents(
                engine,
                componentValue.value || componentValue.componentIds,
              );
              componentValue = { componentIds };
              const NetworkEntityComponent = engine.getComponent(
                NetworkEntity.componentId,
              ) as typeof NetworkEntity;
              NetworkEntityComponent.create(targetEntity, {
                entityId: enumEntityId.getNextEnumEntityId(),
                networkId: 0,
              });
              break;
            }
          }

          if (componentName === CoreComponents.TRANSFORM || componentName === Name.componentName) {
            continue;
          }

          try {
            const Component = engine.getComponent(
              componentName,
            ) as LastWriteWinElementSetComponentDefinition<unknown>;
            Component.createOrReplace(targetEntity, componentValue);
          } catch (error) {
            console.error(
              `Failed to create component ${componentName} for entity ${targetEntity}:`,
              error,
            );
            // Skip components that don't exist in the engine
          }
        }
      }

      // Rewrite Trigger `actions[].id` / `conditions[].id` placeholder strings
      // ({self:Component} / {N:Component}) into the numeric IDs allocated above.
      // Runs after the per-component loop so Triggers components are live on
      // their target entities (`getMutableOrNull` resolves them).
      const triggerSpawnedEntities: [Entity, number][] = [];
      for (const [compositeEntityId, destEntity] of entities) {
        triggerSpawnedEntities.push([destEntity, compositeEntityId]);
      }
      remapTriggerReferences(engine, triggerSpawnedEntities, ids);

      if (!mainEntity) {
        throw new Error('No main entity found');
      }

      if (assetId && custom) {
        CustomAsset.createOrReplace(mainEntity, { assetId });
      }

      if (custom) {
        const customItemTags = composite.components.find(
          component => component.name === Tags.componentName,
        );
        if (customItemTags) {
          for (const [_, component] of Object.entries(customItemTags.data)) {
            if (component.json?.tags) {
              for (const tag of component.json.tags) {
                const currentSceneTags = Tags.getMutableOrNull(engine.RootEntity);
                if (currentSceneTags) {
                  if (!currentSceneTags.tags.includes(tag)) {
                    currentSceneTags.tags.push(tag);
                  }
                } else {
                  Tags.create(engine.RootEntity, { tags: [tag] });
                }
              }
            }
          }
        }
      }

      // update selection
      updateSelectedEntity(engine)(mainEntity);
      return mainEntity;
    } else {
      // Handle non-composite case
      const mainEntity = addChild(engine)(parent, name);
      Transform.createOrReplace(mainEntity, { parent, position: normalizedPosition });

      GltfContainer.create(mainEntity, {
        src: `${base}/${src}`,
        visibleMeshesCollisionMask: 0,
        invisibleMeshesCollisionMask: 3,
      });

      // update selection
      updateSelectedEntity(engine)(mainEntity);
      return mainEntity;
    }
  };
}

export default addAsset;
