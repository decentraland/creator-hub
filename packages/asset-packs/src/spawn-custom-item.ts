import type { Entity, IEngine, PBMaterial, TextureUnion, Vector3Type } from '@dcl/ecs';
import { getJson, getPayload } from './action-types';
import { ActionType } from './enums';
import { COMPONENTS_WITH_ID, getNextId } from './id';
import { isLastWriteWinComponent } from './lww';
import type { AssetComposite } from './types';

// Core ECS component names — matched against composite entries
const CORE_TRANSFORM = 'core::Transform';
const CORE_NAME = 'core::Name';
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_AUDIO_SOURCE = 'core::AudioSource';
const CORE_VIDEO_PLAYER = 'core::VideoPlayer';
const CORE_MATERIAL = 'core::Material';
const CORE_GLTF_NODE_MODIFIERS = 'core::GltfNodeModifiers';

// Editor-only component name prefix — these components only exist in the Inspector
// and should be skipped when instantiating in the runtime.
const EDITOR_COMPONENT_PREFIX = 'inspector::';

export type SpawnCustomItemOptions = {
  /** World position for the spawned root entity. Defaults to { x: 0, y: 0, z: 0 }. */
  position?: Vector3Type;
  /** Parent entity. When omitted, no parent is set. */
  parent?: Entity;
  /**
   * Base path used to resolve `{assetPath}` placeholders in component values
   * (e.g. GLTF src, audio URLs, texture src).
   *
   * Typically this is the relative path to the custom item assets directory
   * inside the scene, e.g. `'assets/custom/my-monster'`.
   */
  assetPath?: string;
};

/**
 * Instantiates a Custom Item entity tree from an `AssetComposite` definition at runtime.
 *
 * Call this from your scene TypeScript code after loading the composite:
 *
 * ```ts
 * import monsterComposite from './assets/custom/monster/composite.json'
 * import { spawnCustomItem } from '@dcl/asset-packs'
 *
 * const monster = spawnCustomItem(engine, monsterComposite, {
 *   position: { x: 8, y: 0, z: 8 },
 *   assetPath: 'assets/custom/monster',
 * })
 * ```
 *
 * @param engine - The ECS engine instance.
 * @param composite - The composite definition loaded from `composite.json`.
 * @param options - Spawn options (position, parent, assetPath).
 * @returns The root entity of the spawned item.
 */
export function spawnCustomItem(
  engine: IEngine,
  composite: AssetComposite,
  options: SpawnCustomItemOptions = {},
): Entity {
  const { position = { x: 0, y: 0, z: 0 }, parent, assetPath = '' } = options;

  // Collect all unique entity IDs referenced in the composite
  const entityIds = new Set<Entity>();
  // Map from composite entity ID → real engine entity
  const entities = new Map<Entity, Entity>();
  // Map from entity → its intended parent entity (composite ID)
  const parentOf = new Map<Entity, Entity>();

  // --- Pass 1: Collect entities and Transform parent relationships ---
  const transformComponent = composite.components.find(c => c.name === CORE_TRANSFORM);
  if (transformComponent) {
    for (const [entityId, transformData] of Object.entries(transformComponent.data)) {
      const entity = Number(entityId) as Entity;
      entityIds.add(entity);
      if (typeof transformData.json.parent === 'number') {
        parentOf.set(entity, transformData.json.parent as Entity);
        entityIds.add(transformData.json.parent as Entity);
      }
    }
  }

  // Collect any entity IDs referenced in other components (e.g. components without Transform)
  for (const component of composite.components) {
    if (component.name === CORE_TRANSFORM) continue;
    for (const entityId of Object.keys(component.data)) {
      entityIds.add(Number(entityId) as Entity);
    }
  }

  // If the composite is completely empty, return a bare entity at the requested position
  if (entityIds.size === 0) {
    const emptyEntity = engine.addEntity();
    try {
      const Transform = engine.getComponent(CORE_TRANSFORM) as any;
      Transform.createOrReplace(emptyEntity, { position, parent });
    } catch {
      // Transform not registered — unlikely, but handle gracefully
    }
    return emptyEntity;
  }

  // --- Pass 2: Identify root entities (no parent in the composite tree) ---
  const roots = new Set<Entity>();
  for (const entityId of entityIds) {
    if (!parentOf.has(entityId)) {
      roots.add(entityId);
    }
  }

  // --- Pass 3: Create engine entities for all composite entity IDs ---
  let mainEntity: Entity | undefined;

  if (entityIds.size === 1) {
    // Single entity — it becomes the main entity directly
    const onlyId = entityIds.values().next().value as Entity;
    mainEntity = engine.addEntity();
    entities.set(onlyId, mainEntity);
  } else {
    // Multi-entity tree: create all entities first, then wire up parents
    for (const entityId of entityIds) {
      entities.set(entityId, engine.addEntity());
    }

    // Wire up parent–child relationships via Transform
    try {
      const Transform = engine.getComponent(CORE_TRANSFORM) as any;
      if (transformComponent) {
        for (const [entityIdStr, transformData] of Object.entries(transformComponent.data)) {
          const entityId = Number(entityIdStr) as Entity;
          const entity = entities.get(entityId)!;
          const transformValue = { ...transformData.json };

          if (typeof transformValue.parent === 'number') {
            const compositeParent = transformValue.parent as Entity;
            const realParent = entities.get(compositeParent);
            if (realParent !== undefined) {
              transformValue.parent = realParent;
            } else {
              console.warn(
                `[spawnCustomItem] No real entity found for composite parent ID ${compositeParent}`,
              );
              delete transformValue.parent;
            }
          }

          Transform.createOrReplace(entity, transformValue);
        }
      }
    } catch {
      // Transform component not registered; skip
    }

    // Determine main entity (root of the composite tree)
    if (roots.size === 1) {
      const rootCompositeId = Array.from(roots)[0];
      mainEntity = entities.get(rootCompositeId)!;
    } else {
      // Multiple roots: pick the first as main
      mainEntity = entities.get(Array.from(entityIds)[0])!;
    }
  }

  // --- Pass 4: Pre-generate IDs for components that require a unique numeric ID ---
  // This must happen BEFORE processing component values so cross-entity references can be resolved.
  const generatedIds = new Map<string, number>(); // key = `${componentName}:${compositeEntityId}`
  const componentValues = new Map<string, any>(); // key = `${componentName}:${compositeEntityId}`

  for (const component of composite.components) {
    const componentName = component.name;
    for (const [entityId, data] of Object.entries(component.data)) {
      const key = `${componentName}:${entityId}`;
      const value = { ...data.json };
      if (COMPONENTS_WITH_ID.includes(componentName) && isSelf(value.id)) {
        const newId = getNextId(engine);
        generatedIds.set(key, newId);
        value.id = newId;
      }
      componentValues.set(key, value);
    }
  }

  // --- Pass 5: Apply position/parent to the root (main) entity ---
  try {
    const Transform = engine.getComponent(CORE_TRANSFORM) as any;
    if (entityIds.size === 1) {
      // Single entity: set position directly
      Transform.createOrReplace(mainEntity!, { position, parent });
    } else if (roots.size === 1) {
      // Multi-entity: update root transform to use caller's position/parent
      const rootTransform = Transform.getMutableOrNull(mainEntity!);
      if (rootTransform) {
        rootTransform.position = position;
        if (parent !== undefined) {
          rootTransform.parent = parent;
        } else {
          delete rootTransform.parent;
        }
      } else {
        Transform.createOrReplace(mainEntity!, { position, parent });
      }
    }
  } catch {
    // Transform not available
  }

  // Helper: resolve ID token references
  const resolveId = (id: string | number, compositeEntityId: string): string | number => {
    if (typeof id !== 'string') return id;

    // {self:ComponentName} — same entity, specific component
    const selfMatch = id.match(/^\{self:(.+)\}$/);
    if (selfMatch) {
      const compName = selfMatch[1];
      const key = `${compName}:${compositeEntityId}`;
      return generatedIds.get(key) ?? id;
    }

    // {entityId:ComponentName} — cross-entity reference
    const crossMatch = id.match(/^\{(\d+):(.+)\}$/);
    if (crossMatch) {
      const [, refEntityId, compName] = crossMatch;
      const key = `${compName}:${refEntityId}`;
      return generatedIds.get(key) ?? id;
    }

    return id;
  };

  // Helper: replace {assetPath} in a string value
  const resolveAssetPath = (value: string): string =>
    assetPath ? value.replace('{assetPath}', assetPath) : value;

  // Helper: resolve {assetPath} and {self} in material textures
  const resolveTexture = (texture?: TextureUnion): TextureUnion | undefined => {
    if (!texture) return texture;
    if (texture.tex?.$case === 'texture') {
      return {
        tex: {
          $case: 'texture',
          texture: {
            ...texture.tex.texture,
            src: resolveAssetPath(texture.tex.texture.src),
          },
        },
      };
    }
    return texture;
  };

  const resolveMaterial = (material: PBMaterial): PBMaterial => {
    switch (material.material?.$case) {
      case 'unlit':
        return {
          material: {
            $case: 'unlit',
            unlit: {
              ...material.material.unlit,
              texture: resolveTexture(material.material.unlit.texture),
            },
          },
        };
      case 'pbr':
        return {
          material: {
            $case: 'pbr',
            pbr: {
              ...material.material.pbr,
              texture: resolveTexture(material.material.pbr.texture),
              alphaTexture: resolveTexture(material.material.pbr.alphaTexture),
              bumpTexture: resolveTexture(material.material.pbr.bumpTexture),
              emissiveTexture: resolveTexture(material.material.pbr.emissiveTexture),
            },
          },
        };
    }
    return material;
  };

  // --- Pass 6: Create all non-Transform/non-Name components on each entity ---
  for (const component of composite.components) {
    const componentName = component.name;

    // Skip Transform (already handled) and Name (editor-only label)
    if (componentName === CORE_TRANSFORM || componentName === CORE_NAME) continue;

    // Skip editor-only components (Inspector internals not present at runtime)
    if (componentName.startsWith(EDITOR_COMPONENT_PREFIX)) continue;

    for (const [entityIdStr] of Object.entries(component.data)) {
      const compositeEntityId = Number(entityIdStr) as Entity;
      const targetEntity = entities.get(compositeEntityId);
      if (targetEntity === undefined) continue;

      const key = `${componentName}:${entityIdStr}`;
      let value = componentValues.get(key);
      if (value === undefined) continue;

      // Apply component-specific transformations
      switch (componentName) {
        case CORE_GLTF_CONTAINER: {
          value = {
            ...value,
            visibleMeshesCollisionMask: value.visibleMeshesCollisionMask ?? 0,
            invisibleMeshesCollisionMask: value.invisibleMeshesCollisionMask ?? 3,
            src: resolveAssetPath(value.src),
          };
          break;
        }

        case CORE_AUDIO_SOURCE: {
          value = { ...value, audioClipUrl: resolveAssetPath(value.audioClipUrl) };
          break;
        }

        case CORE_VIDEO_PLAYER: {
          value = { ...value, src: resolveAssetPath(value.src) };
          break;
        }

        case CORE_MATERIAL: {
          value = resolveMaterial(value as PBMaterial);
          break;
        }

        case CORE_GLTF_NODE_MODIFIERS: {
          value = {
            ...value,
            modifiers: (value.modifiers ?? []).map((modifier: any) => ({
              ...modifier,
              material: modifier.material ? resolveMaterial(modifier.material) : modifier.material,
            })),
          };
          break;
        }

        default: {
          // Asset-packs components: resolve {assetPath} in Actions payloads
          // and remap IDs in Triggers
          if (componentName.startsWith('asset-packs::')) {
            // Detect Actions component by name prefix
            if (componentName.startsWith('asset-packs::Actions')) {
              const newActions: any[] = [];
              for (const action of value.value ?? []) {
                switch (action.type) {
                  case ActionType.PLAY_SOUND: {
                    const p = getPayload<ActionType.PLAY_SOUND>(action);
                    newActions.push({
                      ...action,
                      jsonPayload: getJson<ActionType.PLAY_SOUND>({
                        ...p,
                        src: resolveAssetPath(p.src),
                      }),
                    });
                    break;
                  }
                  case ActionType.PLAY_CUSTOM_EMOTE: {
                    const p = getPayload<ActionType.PLAY_CUSTOM_EMOTE>(action);
                    newActions.push({
                      ...action,
                      jsonPayload: getJson<ActionType.PLAY_CUSTOM_EMOTE>({
                        ...p,
                        src: resolveAssetPath(p.src),
                      }),
                    });
                    break;
                  }
                  case ActionType.SHOW_IMAGE: {
                    const p = getPayload<ActionType.SHOW_IMAGE>(action);
                    newActions.push({
                      ...action,
                      jsonPayload: getJson<ActionType.SHOW_IMAGE>({
                        ...p,
                        src: resolveAssetPath(p.src),
                      }),
                    });
                    break;
                  }
                  default:
                    newActions.push(action);
                }
              }
              value = { ...value, value: newActions };
            }

            // Detect Triggers component by name prefix
            if (componentName.startsWith('asset-packs::Triggers')) {
              const newTriggers = (value.value ?? []).map((trigger: any) => ({
                ...trigger,
                conditions: (trigger.conditions ?? []).map((condition: any) => ({
                  ...condition,
                  id: resolveId(condition.id, entityIdStr),
                })),
                actions: (trigger.actions ?? []).map((triggerAction: any) => ({
                  ...triggerAction,
                  id: resolveId(triggerAction.id, entityIdStr),
                })),
              }));
              value = { ...value, value: newTriggers };
            }
          }
          break;
        }
      }

      // Write the component onto the target entity
      try {
        const Component = engine.getComponent(componentName) as any;
        if (isLastWriteWinComponent(Component)) {
          Component.createOrReplace(targetEntity, value);
        }
      } catch {
        console.warn(
          `[spawnCustomItem] Component "${componentName}" not registered in engine — skipping`,
        );
      }
    }
  }

  return mainEntity!;
}

// --- Internal helpers ---

function isSelf(value: unknown): boolean {
  return `${value}` === '{self}';
}
