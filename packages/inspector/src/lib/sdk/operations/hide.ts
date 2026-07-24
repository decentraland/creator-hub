import type { IEngine, Entity } from '@dcl/ecs';
import { getComponentEntityTree, Transform as TransformEngine } from '@dcl/ecs';
import type { EditorComponents } from '../components';
import { EditorComponentNames } from '../components';
import { addComponent as createAddComponent } from './add-component';
import { removeComponent as createRemoveComponent } from './remove-component';

export function hide(engine: IEngine) {
  return function hide(entity: Entity, value: boolean): void {
    const addComponent = createAddComponent(engine);
    const removeComponent = createRemoveComponent(engine);
    const Transform = engine.getComponent(TransformEngine.componentId) as typeof TransformEngine;
    const Hide = engine.getComponent(EditorComponentNames.Hide) as EditorComponents['Hide'];

    // Apply the hide to the entity and all its children
    const tree = Array.from(getComponentEntityTree(engine, entity, Transform));
    for (const node of tree) {
      if (value) {
        // Guard: a node in the tree may already carry Hide (e.g. a child hidden
        // earlier, then the parent hidden) — addComponent uses component.create,
        // which throws if it already exists ("already exists"). Skip those.
        if (!Hide.has(node)) addComponent(node, Hide.componentId, { value: true });
      } else {
        removeComponent(node, Hide);
      }
    }
  };
}

export default hide;
