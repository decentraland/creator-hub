import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

export function unbindField(engine: IEngine) {
  return function unbindField(entity: Entity, field: string): void {
    const Bindings = engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    if (!Bindings) return;
    const current = Bindings.getOrNull(entity);
    if (!current) return;
    Bindings.createOrReplace(entity, {
      value: current.value.filter(b => b.field !== field) as UIBindings['value'],
    });
  };
}

export default unbindField;
