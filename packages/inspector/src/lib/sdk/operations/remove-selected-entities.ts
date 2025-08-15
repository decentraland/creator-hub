import type { IEngine } from '@dcl/ecs';
import type { EditorComponents } from '../components';
import { EditorComponentNames } from '../components';

export function removeSelectedEntities(engine: IEngine) {
  return function removeSelectedEntities() {
    const Selection = engine.getComponent(
      EditorComponentNames.Selection,
    ) as EditorComponents['Selection'];
    for (const [entity] of engine.getEntitiesWith(Selection)) {
      Selection.deleteFrom(entity);
    }
  };
}

export default removeSelectedEntities;
