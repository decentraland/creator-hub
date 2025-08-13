import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';

import type { EditorComponentsTypes } from '../../../../sdk/components';
import { EditorComponentNames } from '../../../../sdk/components';
import { GizmoType } from '../../../../utils/gizmo';

function system(
  engine: IEngine,
  Selection: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Selection']>,
) {
  engine.removeSystem(system);
  Selection!.createOrReplace(engine.RootEntity, { gizmo: GizmoType.FREE });
}

export function selectSceneEntity(engine: IEngine) {
  const Selection = engine.getComponentOrNull(
    EditorComponentNames.Selection,
  ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Selection']> | null;

  if (Selection) {
    for (const [entity] of engine.getEntitiesWith(Selection)) {
      Selection.deleteFrom(entity);
    }

    engine.addSystem(() => system(engine, Selection));
  }
}
