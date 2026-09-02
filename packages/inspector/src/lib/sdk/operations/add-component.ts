import type { Entity, IEngine, Vector3Type } from '@dcl/ecs';
import { COMPONENTS_WITH_ID, getNextId } from '@dcl/asset-packs';
import { isLastWriteWinComponent } from '../../../hooks/sdk/useComponentValue';
import { getEntityScale, isAreaComponent } from './area-size';

export function addComponent(engine: IEngine) {
  return function addComponent(entity: Entity, componentId: number, value?: any) {
    const component = engine.getComponent(componentId);
    if (isLastWriteWinComponent<{ id?: number; area?: Vector3Type }>(component)) {
      component.create(entity, value);
      if (COMPONENTS_WITH_ID.includes(component.componentName)) {
        const value = component.getMutable(entity);
        value.id = getNextId(engine as any);
      }
      // Area components mirror the entity's scale in their `area` field (the
      // runtime ignores the Transform scale for the region size), so a freshly
      // added component starts with the region the entity's scale describes.
      if (isAreaComponent(component.componentName)) {
        const mutable = component.getMutable(entity);
        if (!mutable.area) {
          mutable.area = getEntityScale(engine, entity);
        }
      }
    } else {
      throw new Error('Cannot add component: it must be an LWW component');
    }
  };
}

export default addComponent;
