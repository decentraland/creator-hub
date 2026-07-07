import type { Entity, IEngine, TransformComponentExtended } from '@dcl/ecs';
import { getComponentEntityTree } from '@dcl/ecs';
import { createIdMap, createEntityMap, remapTriggerActionRefs, requiresId } from './mapping';
import { isLastWriteWinComponent } from './lww';
import type { ISDKHelpers, TriggersComponent } from './definitions';
import { getExplorerComponents } from './components';
import { getNextId } from './mapping';

export function clone(
  entity: Entity,
  engine: IEngine,
  Transform: TransformComponentExtended,
  Triggers: TriggersComponent,
  sdkHelpers?: ISDKHelpers,
) {
  const idMap = createIdMap();
  const entityMap = createEntityMap();
  const tree = getComponentEntityTree(engine, entity, Transform);
  const { NetworkEntity, SyncComponents } = getExplorerComponents(engine);
  for (const original of tree) {
    const cloned = engine.addEntity();

    for (const component of engine.componentsIter()) {
      if (component.has(original)) {
        let newValue = JSON.parse(JSON.stringify(component.get(original)));
        if (requiresId(component)) {
          const oldId = newValue.id;
          const newId = getNextId(engine);
          idMap.remember(oldId, newId);
          newValue = {
            ...newValue,
            id: newId,
          };
        }

        if (isLastWriteWinComponent(component)) {
          component.createOrReplace(cloned, newValue);
        }
      }
    }
    entityMap.put(original, cloned);
  }

  const clones = Array.from(entityMap.entries(), ([, dst]) => dst).reverse();

  for (const cloned of clones) {
    // if the entity has triggers, remap the old ids in the actions and conditions to the new ones
    if (Triggers.has(cloned)) {
      const triggers = Triggers.getMutable(cloned);
      remapTriggerActionRefs(triggers.value, idMap);
    }

    // Fix the NetworkEntity component for the new entity.
    if (NetworkEntity.has(cloned)) {
      const syncComponent = SyncComponents.getOrNull(cloned);

      if (syncComponent && sdkHelpers?.syncEntity) {
        sdkHelpers?.syncEntity(cloned, syncComponent.componentIds);
      }
    }

    // TODO: should we fix the parent network entity also ?
    const transform = Transform.getMutableOrNull(cloned);
    if (transform && transform.parent) {
      const newParent = entityMap.get(transform.parent);
      if (newParent) {
        transform.parent = newParent;
      }
    }
  }

  const cloned = clones[0];

  // Maintain the existing shape (`ids: Map<number, number>`, `entities:
  // Map<Entity, Entity>`) for callers that previously read the maps
  // directly. The new primitives back both views with the same data.
  const ids = new Map<number, number>();
  for (const [oldId, newId] of idMap.entries()) ids.set(oldId, newId);
  const entities = new Map<Entity, Entity>();
  for (const [src, dst] of entityMap.entries()) entities.set(src, dst);

  return { ids, entities, cloned };
}
