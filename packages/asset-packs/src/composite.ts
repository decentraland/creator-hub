import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { Transform as TransformEngine, Name } from '@dcl/ecs';
import { COMPONENTS_WITH_ID, getNextId } from './id';
import type { ISDKHelpers } from './definitions';
import { ComponentName } from './enums';
import type { AssetComposite } from './types';

const EDITOR_COMPONENT_PREFIXES = ['inspector::', 'editor::'];

function isEditorComponent(componentName: string): boolean {
  return EDITOR_COMPONENT_PREFIXES.some(prefix => componentName.startsWith(prefix));
}

function isSelfRef(value: unknown): boolean {
  return `${value}` === '{self}';
}

function mapIdRef(
  id: string | number,
  entityId: string,
  ids: Map<string, number>,
): string | number {
  if (typeof id === 'string') {
    // Handle {self:ComponentName} references
    const selfMatch = id.match(/^\{self:(.+)\}$/);
    if (selfMatch) {
      const componentName = selfMatch[1];
      const key = `${componentName}:${entityId}`;
      return ids.get(key) ?? id;
    }
    // Handle {entityId:ComponentName} cross-entity references
    const crossEntityMatch = id.match(/^\{(\d+):(.+)\}$/);
    if (crossEntityMatch) {
      const [, refEntityId, componentName] = crossEntityMatch;
      const key = `${componentName}:${refEntityId}`;
      return ids.get(key) ?? id;
    }
  }
  return id;
}

function parseMaterialSrc(material: any, basePath: string): any {
  if (!material || !basePath) return material;
  const replaceAssetPath = (src: string) => src.replace('{assetPath}', basePath);

  const m = material.material;
  if (!m) return material;
  if (m.$case === 'unlit' && m.unlit?.texture?.tex?.$case === 'texture') {
    return {
      ...material,
      material: {
        ...m,
        unlit: {
          ...m.unlit,
          texture: {
            ...m.unlit.texture,
            tex: {
              ...m.unlit.texture.tex,
              texture: { ...m.unlit.texture.tex.texture, src: replaceAssetPath(m.unlit.texture.tex.texture.src) },
            },
          },
        },
      },
    };
  }
  if (m.$case === 'pbr') {
    const mapTex = (tex: any) => {
      if (tex?.tex?.$case === 'texture') {
        return { ...tex, tex: { ...tex.tex, texture: { ...tex.tex.texture, src: replaceAssetPath(tex.tex.texture.src) } } };
      }
      return tex;
    };
    return {
      ...material,
      material: {
        ...m,
        pbr: {
          ...m.pbr,
          texture: mapTex(m.pbr?.texture),
          alphaTexture: mapTex(m.pbr?.alphaTexture),
          bumpTexture: mapTex(m.pbr?.bumpTexture),
          emissiveTexture: mapTex(m.pbr?.emissiveTexture),
        },
      },
    };
  }
  return material;
}

export interface SpawnFromCompositeOptions {
  /** Entity to attach the spawned tree to. Defaults to engine.RootEntity. */
  parent?: Entity;
  /** Position override for the root entity. */
  position?: { x: number; y: number; z: number };
  /** Rotation override for the root entity. */
  rotation?: { x: number; y: number; z: number; w: number };
  /** Scale override for the root entity. */
  scale?: { x: number; y: number; z: number };
  /**
   * Base path for resolving `{assetPath}` placeholders in the composite.
   * When using the auto-generated `spawnCustomItem()` helper, this is
   * already pre-resolved and you do not need to provide it.
   */
  basePath?: string;
  /** SDK helpers for multiplayer scenes (NetworkEntity/SyncComponents support). */
  sdkHelpers?: ISDKHelpers;
}

/**
 * Spawn a new entity tree from a composite definition at scene runtime.
 *
 * @example
 * ```ts
 * import { spawnFromComposite } from '@dcl/asset-packs'
 * import MONSTER_COMPOSITE from './assets/custom/monster/composite.json'
 *
 * const root = spawnFromComposite(engine, MONSTER_COMPOSITE, {
 *   position: { x: 8, y: 0, z: 8 },
 * })
 * // To despawn: engine.removeEntityWithChildren(root)
 * ```
 *
 * IMPORTANT: If the composite contains Smart Item components (Actions, Triggers,
 * States), call `initAssetPacks()` before `spawnFromComposite()`.
 */
export function spawnFromComposite(
  engine: IEngine,
  composite: AssetComposite,
  options: SpawnFromCompositeOptions = {},
): Entity {
  const { parent, position, rotation, scale, basePath = '', sdkHelpers } = options;
  const parentEntity = parent ?? engine.RootEntity;

  const Transform = engine.getComponent(TransformEngine.componentId) as typeof TransformEngine;
  const NameComponent = engine.getComponentOrNull(Name.componentId) as typeof Name | null;

  // ── Step 1: collect all entity IDs from composite ───────────────────────
  const entityIds = new Set<number>();
  const parentOf = new Map<number, number>();
  const transformValues = new Map<number, any>();
  const entityNames = new Map<number, string>();

  const transformComp = composite.components.find(c => c.name === 'core::Transform');
  if (transformComp) {
    for (const [idStr, data] of Object.entries(transformComp.data)) {
      const id = Number(idStr);
      entityIds.add(id);
      const t = data.json;
      transformValues.set(id, t);
      if (typeof t?.parent === 'number') {
        parentOf.set(id, t.parent);
        entityIds.add(t.parent);
      }
    }
  }

  const nameComp = composite.components.find(
    c => c.name === Name.componentName || c.name === 'core::Name',
  );
  if (nameComp) {
    for (const [idStr, data] of Object.entries(nameComp.data)) {
      entityNames.set(Number(idStr), data.json?.value ?? '');
    }
  }

  for (const comp of composite.components) {
    for (const idStr of Object.keys(comp.data)) {
      entityIds.add(Number(idStr));
    }
  }

  // ── Step 2: find roots (entities with no parent in the composite) ────────
  const roots = new Set<number>();
  for (const id of entityIds) {
    if (!parentOf.has(id)) roots.add(id);
  }

  if (entityIds.size === 0) {
    // Empty composite: create a placeholder entity
    const emptyEntity = engine.addEntity();
    Transform.createOrReplace(emptyEntity, {
      parent: parentEntity,
      position: position ?? { x: 0, y: 0, z: 0 },
      rotation: rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      scale: scale ?? { x: 1, y: 1, z: 1 },
    });
    return emptyEntity;
  }

  // ── Step 3: determine composite root name ────────────────────────────────
  const compositeRootId = roots.size === 1 ? Array.from(roots)[0] : null;
  const rootName = compositeRootId != null
    ? (entityNames.get(compositeRootId) ?? 'Custom_Item')
    : 'Custom_Item';

  // ── Step 4: pre-generate IDs for COMPONENTS_WITH_ID ─────────────────────
  const ids = new Map<string, number>(); // key: `ComponentName:entityId`
  const values = new Map<string, any>(); // key: `ComponentName:entityId`

  for (const comp of composite.components) {
    if (isEditorComponent(comp.name)) continue;
    for (const [idStr, data] of Object.entries(comp.data)) {
      const key = `${comp.name}:${idStr}`;
      const val = { ...data.json };
      if (COMPONENTS_WITH_ID.includes(comp.name) && isSelfRef(val.id)) {
        const newId = getNextId(engine);
        ids.set(key, newId);
        val.id = newId;
      }
      values.set(key, val);
    }
  }

  // ── Step 5: create entities ──────────────────────────────────────────────
  const entities = new Map<number, Entity>(); // composite ID → live entity

  let mainEntity: Entity | null = null;
  let defaultParent = parentEntity;

  // If multiple roots, create a wrapper entity
  if (roots.size > 1) {
    const wrapperEntity = engine.addEntity();
    Transform.createOrReplace(wrapperEntity, {
      parent: parentEntity,
      position: position ?? { x: 0, y: 0, z: 0 },
      rotation: rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      scale: scale ?? { x: 1, y: 1, z: 1 },
    });
    if (NameComponent) {
      NameComponent.createOrReplace(wrapperEntity, { value: rootName });
    }
    mainEntity = wrapperEntity;
    defaultParent = wrapperEntity;
  }

  // Single entity: just create it directly
  if (entityIds.size === 1) {
    const id = entityIds.values().next().value as number;
    const entity = engine.addEntity();
    Transform.createOrReplace(entity, {
      parent: parentEntity,
      position: position ?? { x: 0, y: 0, z: 0 },
      rotation: rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      scale: scale ?? { x: 1, y: 1, z: 1 },
    });
    if (NameComponent) {
      NameComponent.createOrReplace(entity, { value: rootName });
    }
    entities.set(id, entity);
    mainEntity = entity;
  } else {
    // Multiple entities: need two passes to resolve parents
    const orphaned = new Map<number, number>(); // entityId → intended parentId

    for (const id of entityIds) {
      const isRoot = roots.has(id);
      const intendedParentId = parentOf.get(id);
      const resolvedParent =
        isRoot ? defaultParent : (typeof intendedParentId === 'number' ? entities.get(intendedParentId) : undefined);

      if (!isRoot && typeof intendedParentId === 'number' && resolvedParent === undefined) {
        orphaned.set(id, intendedParentId);
      }

      const entity = engine.addEntity();
      const tval = transformValues.get(id);
      const entityParent = resolvedParent ?? defaultParent;

      Transform.createOrReplace(entity, {
        parent: entityParent,
        position: tval?.position ?? { x: 0, y: 0, z: 0 },
        rotation: tval?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
        scale: tval?.scale ?? { x: 1, y: 1, z: 1 },
      });

      const entityNameValue = entityNames.get(id) ?? `entity_${id}`;
      if (NameComponent) {
        NameComponent.createOrReplace(entity, { value: entityNameValue });
      }

      entities.set(id, entity);
    }

    // Fix orphaned entities
    for (const [id, intendedParentId] of orphaned) {
      const entity = entities.get(id)!;
      const resolvedParent = entities.get(intendedParentId);
      if (entity && resolvedParent) {
        const tval = transformValues.get(id);
        Transform.createOrReplace(entity, {
          parent: resolvedParent,
          position: tval?.position ?? { x: 0, y: 0, z: 0 },
          rotation: tval?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: tval?.scale ?? { x: 1, y: 1, z: 1 },
        });
      }
    }

    // Override root entity transform with caller's options
    if (compositeRootId != null) {
      const rootEntity = entities.get(compositeRootId);
      if (rootEntity) {
        const tval = transformValues.get(compositeRootId);
        Transform.createOrReplace(rootEntity, {
          parent: parentEntity,
          position: position ?? tval?.position ?? { x: 0, y: 0, z: 0 },
          rotation: rotation ?? tval?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
          scale: scale ?? tval?.scale ?? { x: 1, y: 1, z: 1 },
        });
        mainEntity = rootEntity;
      }
    }
  }

  if (!mainEntity) {
    throw new Error('spawnFromComposite: failed to create main entity');
  }

  // ── Step 6: apply all components ─────────────────────────────────────────
  for (const comp of composite.components) {
    const componentName = comp.name;

    // Skip editor-only components
    if (isEditorComponent(componentName)) continue;
    // Skip Transform and Name (already handled above)
    if (componentName === 'core::Transform' || componentName === Name.componentName || componentName === 'core::Name') continue;

    for (const [idStr] of Object.entries(comp.data)) {
      const entityId = Number(idStr);
      const targetEntity = entities.get(entityId);
      if (!targetEntity) continue;

      const key = `${componentName}:${idStr}`;
      let compValue = values.get(key) ?? comp.data[idStr].json;

      // Apply {assetPath} replacement
      if (basePath) {
        compValue = JSON.parse(
          JSON.stringify(compValue).replace(/\{assetPath\}/g, basePath),
        );
      }

      switch (componentName) {
        case ComponentName.ACTIONS: {
          // remap action IDs in payloads referencing other component IDs
          if (Array.isArray(compValue?.value)) {
            compValue = {
              ...compValue,
              value: compValue.value.map((action: any) => ({
                ...action,
                id: typeof action.id === 'number' ? action.id : mapIdRef(action.id, idStr, ids),
              })),
            };
          }
          break;
        }
        case ComponentName.TRIGGERS: {
          if (Array.isArray(compValue?.value)) {
            compValue = {
              ...compValue,
              value: compValue.value.map((trigger: any) => ({
                ...trigger,
                conditions: (trigger.conditions ?? []).map((condition: any) => ({
                  ...condition,
                  id: mapIdRef(condition.id, idStr, ids),
                })),
                actions: (trigger.actions ?? []).map((action: any) => ({
                  ...action,
                  id: mapIdRef(action.id, idStr, ids),
                })),
              })),
            };
          }
          break;
        }
        case 'core::Material': {
          compValue = parseMaterialSrc(compValue, basePath);
          break;
        }
        case 'core::SyncComponents': {
          if (sdkHelpers?.syncEntity) {
            const componentIds: number[] = (compValue.value ?? compValue.componentIds ?? []).reduce(
              (acc: number[], name: string) => {
                try {
                  const c = engine.getComponent(name);
                  return [...acc, c.componentId];
                } catch {
                  console.error(`spawnFromComposite: component "${name}" not found, skipping SyncComponents entry`);
                  return acc;
                }
              },
              [],
            );
            if (componentIds.length > 0) {
              sdkHelpers.syncEntity(targetEntity, componentIds);
            }
          }
          continue;
        }
      }

      // Apply the component to the target entity
      try {
        const Component = engine.getComponent(
          componentName,
        ) as LastWriteWinElementSetComponentDefinition<unknown>;
        Component.createOrReplace(targetEntity, compValue);
      } catch {
        console.error(
          `spawnFromComposite: component "${componentName}" not found in engine — skipping. ` +
          `If this is a Smart Item component, ensure initAssetPacks() was called first.`,
        );
      }
    }
  }

  return mainEntity;
}
