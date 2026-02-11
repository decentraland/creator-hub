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
import { getNodes, pushChildToNodes } from '../nodes';
import type { GizmoType } from '../../utils/gizmo';
import updateSelectedEntity from './update-selected-entity';
import { generateUniqueName } from './add-child';

export function duplicateEntity(engine: IEngine) {
  const enumEntityId = createEnumEntityId(engine);
  return function duplicateEntity(entity: Entity, preferredGizmo?: GizmoType) {
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
        newNodes = pushChildToNodes(newNodes, engine.RootEntity, duplicate);
      } else {
        const parent = entities.get(transform.parent) || transform.parent;
        newNodes = pushChildToNodes(newNodes, parent, duplicate);
      }
    }

    // Single atomic update to the Nodes component after all entities are processed
    // This creates only ONE undo operation for all node changes, instead of one per entity.
    Nodes.createOrReplace(engine.RootEntity, { value: newNodes as Node[] });

    updateSelectedEntity(engine)(cloned, true, preferredGizmo);
    return cloned;
  };
}

export default duplicateEntity;
