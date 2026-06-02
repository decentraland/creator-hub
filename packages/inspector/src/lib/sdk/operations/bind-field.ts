import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

export function bindField(engine: IEngine) {
  return function bindField(entity: Entity, field: string, variable: string): void {
    const Bindings = engine.getComponent(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings>;
    const current = Bindings.getOrNull(entity);
    const rows = current?.value ?? [];
    const without = rows.filter(b => b.field !== field);
    Bindings.createOrReplace(entity, { value: [...without, { field, variable }] });
  };
}

export default bindField;
