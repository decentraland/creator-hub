import type { Entity, IEngine } from '@dcl/ecs';
import { getComponentEntityTree, Transform as TransformEngine } from '@dcl/ecs';

import { isLastWriteWinComponent } from '../../../hooks/sdk/useComponentValue';
import type { EditorComponents } from '../components';
import { EditorComponentNames } from '../components';
import { removeNode, getParent } from '../nodes';

export function removeEntity(engine: IEngine) {
  return function removeEntity(entity: Entity) {
    const Transform = engine.getComponent(TransformEngine.componentName) as typeof TransformEngine;
    const Nodes = engine.getComponent(EditorComponentNames.Nodes) as EditorComponents['Nodes'];
    const Selection = engine.getComponent(
      EditorComponentNames.Selection,
    ) as EditorComponents['Selection'];

    // Check if entity being removed or any of its children are currently selected
    const entityTree = Array.from(getComponentEntityTree(engine, entity, Transform));
    const wasSelected = entityTree.some(e => Selection.has(e));

    // Get parent and gizmo before removing entity (for potential selection)
    if (wasSelected) {
      const nodes = Nodes.getOrNull(engine.RootEntity)?.value || [];
     const parentToSelect = getParent(entity, nodes);
      const selectedGizmo =
        Selection.getOrNull(entity)?.gizmo ||
        (entityTree.find(e => Selection.has(e)) &&
          Selection.getOrNull(entityTree.find(e => Selection.has(e))!)?.gizmo) ||
        0;
      Selection.createOrReplace(parentToSelect, { gizmo: selectedGizmo });
    }

    // Remove entity and all its children
    for (const entityIterator of getComponentEntityTree(engine, entity, Transform)) {
      Nodes.createOrReplace(engine.RootEntity, { value: removeNode(engine, entityIterator) });
      for (const component of engine.componentsIter()) {
        if (component.has(entityIterator) && isLastWriteWinComponent(component)) {
          component.deleteFrom(entityIterator);
        }
      }
    }
  };
}

export default removeEntity;
