import type { IEngine, Entity } from '@dcl/ecs';
import type { EditorComponents } from '../components';
import { EditorComponentNames } from '../components';
import { addComponent as createAddComponent } from './add-component';
import { removeComponent as createRemoveComponent } from './remove-component';

export function lock(engine: IEngine) {
  return function lock(entity: Entity, value: boolean): void {
    const addComponent = createAddComponent(engine);
    const removeComponent = createRemoveComponent(engine);
    const Lock = engine.getComponent(EditorComponentNames.Lock) as EditorComponents['Lock'];

    // Apply the lock only to the selected entity, not to its children
    if (value) {
      addComponent(entity, Lock.componentId, { value: true });
    } else {
      removeComponent(entity, Lock);
    }
  };
}

export default lock;
