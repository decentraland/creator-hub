import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import { assertFieldPath, assertIdentifier } from './validators';

export function bindField(engine: IEngine) {
  return function bindField(entity: Entity, field: string, variable: string): void {
    assertFieldPath(field);
    assertIdentifier(variable, 'variable name');
    const Bindings = engine.getComponent(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings>;
    const current = Bindings.getOrNull(entity);
    const rows = current?.value ?? [];
    const without = rows.filter(b => b.field !== field);
    Bindings.createOrReplace(entity, {
      value: [...without, { field, variable }] as UIBindings['value'],
    });
  };
}

export default bindField;
