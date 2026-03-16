import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName } from '@dcl/asset-packs';

export function removeActionTypesComponent(engine: IEngine) {
  const ActionTypes = engine.getComponentOrNull(
    ComponentName.ACTION_TYPES,
  ) as LastWriteWinElementSetComponentDefinition<unknown> | null;

  if (!ActionTypes) return;

  for (const [entity] of engine.getEntitiesWith(ActionTypes)) {
    ActionTypes.deleteFrom(entity);
  }
}
