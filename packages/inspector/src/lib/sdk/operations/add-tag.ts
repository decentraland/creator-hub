import type { Entity, IEngine } from '@dcl/ecs';
import { TAG_PREFIX } from '../../../components/EntityInspector/TagsInspector/types';

export function addTag(engine: IEngine) {
  return function addTag(entity: Entity, tagName: string): void {
    const tagComponent = engine.defineComponent(`${TAG_PREFIX}${tagName}`, {});
    console.log('TAG COMPONENT', tagComponent);
    if (tagComponent && entity) {
      tagComponent.create(entity, {});
    }
  };
}
