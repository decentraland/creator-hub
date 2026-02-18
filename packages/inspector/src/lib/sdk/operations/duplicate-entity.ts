import type { Entity, IEngine } from '@dcl/ecs';
import {
  Transform as TransformEngine,
  NetworkEntity as NetworkEntityEngine,
  Name as NameEngine,
} from '@dcl/ecs';
import { clone } from '@dcl/asset-packs';
import type { EditorComponents, Node } from '../components';
import { EditorComponentNames } from '../components';
import { createEnumEntityId } from '../enum-entity';
import { getNodes, pushChildToNodes, insertChildAfterInNodes } from '../nodes';
import type { GizmoType } from '../../utils/gizmo';
import updateSelectedEntity from './update-selected-entity';
import { generateUniqueName } from './add-child';

export function duplicateEntity(engine: IEngine) {
  const enumEntityId = createEnumEntityId(engine);
  return function duplicateEntity(
    entity: Entity,
    preferredGizmo?: GizmoType,
    insertAfter?: Entity,
  ) {
    const Transform = engine.getComponent(TransformEngine.componentId) as typeof TransformEngine;
    const Nodes = engine.getComponent(EditorComponentNames.Nodes) as EditorComponents['Nodes'];
    const Triggers = engine.getComponent(
      EditorComponentNames.Triggers,
    ) as EditorComponents['Triggers'];
    const Name = engine.getComponent(NameEngine.componentName) as typeof NameEngine;
    const NetworkEntity = engine.getComponent(
      NetworkEntityEngine.componentId,
    ) as typeof NetworkEntityEngine;

    const { entities, cloned } = clone(
      entity,
      engine as any,
      Transform as any,
      Triggers as any,
    ) as {
      entities: Map<Entity, Entity>;
      cloned: Entity;
    };

    // Update nodes locally instead of calling Nodes.createOrReplace for each entity.
    let newNodes = getNodes(engine);

    for (const [original, duplicate] of Array.from(entities.entries()).reverse()) {
      if (NetworkEntity.has(original)) {
        NetworkEntity.createOrReplace(duplicate, {
          entityId: enumEntityId.getNextEnumEntityId(),
          networkId: 0,
        });
      }

      const originalName = Name.getOrNull(original)?.value;
      Name.createOrReplace(duplicate, {
        value: generateUniqueName(engine, Name, originalName || ''),
      });

      const transform = Transform.getMutableOrNull(duplicate);
      if (transform === null || !transform.parent) {
        const afterEntity = resolveInsertAfter(newNodes, engine.RootEntity, insertAfter, original);
        newNodes = insertChildAfterInNodes(newNodes, engine.RootEntity, duplicate, afterEntity);
      } else {
        const clonedParent = entities.get(transform.parent);
        if (clonedParent) {
          newNodes = pushChildToNodes(newNodes, clonedParent, duplicate);
        } else {
          const parent = transform.parent;
          const afterEntity = resolveInsertAfter(newNodes, parent, insertAfter, original);
          newNodes = insertChildAfterInNodes(newNodes, parent, duplicate, afterEntity);
        }
      }
    }

    // Single atomic update to the Nodes component after all entities are processed
    // This creates only ONE undo operation for all node changes, instead of one per entity.
    Nodes.createOrReplace(engine.RootEntity, { value: newNodes as Node[] });

    updateSelectedEntity(engine)(cloned, true, preferredGizmo);
    return cloned;
  };
}

function resolveInsertAfter(
  nodes: readonly Node[],
  parent: Entity,
  insertAfter: Entity | undefined,
  original: Entity,
): Entity {
  if (insertAfter !== undefined) {
    const parentNode = nodes.find($ => $.entity === parent);
    if (parentNode?.children.includes(insertAfter)) {
      return insertAfter;
    }
  }
  return original;
}

export default duplicateEntity;
