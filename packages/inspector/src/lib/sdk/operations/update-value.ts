import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  TransformType,
} from '@dcl/ecs';
import { CoreComponents } from '../components/types';
import { syncAreaWithScale } from './area-size';

export function updateValue(engine: IEngine) {
  return function updateValue<T = unknown>(
    component: LastWriteWinElementSetComponentDefinition<T>,
    entity: Entity,
    data: Partial<T>,
  ) {
    const value = component.getMutableOrNull(entity);
    if (value === null) return;
    for (const key in data) {
      (value as any)[key] = data[key];
    }
    // Area components (AvatarModifierArea, CameraModeArea) size their region
    // from `area`, not from the Transform scale (the runtime ignores scale).
    // Mirror every scale change into `area` so the placeholder cube shown in
    // the editor always matches the actual region. This is the single seam all
    // Transform writes go through (Transform panel and gizmo commits alike),
    // and it runs before the dispatch, so scale + area share one undo step.
    if (component.componentName === CoreComponents.TRANSFORM) {
      const scale = (data as Partial<TransformType>).scale;
      if (scale) {
        syncAreaWithScale(engine, entity, scale);
      }
    }
  };
}

export default updateValue;
