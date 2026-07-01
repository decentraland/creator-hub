import type { Entity, IEngine } from '@dcl/ecs';

import { assertFieldPath, assertIdentifier } from './validators';
import { getBindingsRows, writeBindingsRows } from './ui-bindings-store';

export function bindField(engine: IEngine) {
  return function bindField(entity: Entity, field: string, variable: string): void {
    assertFieldPath(field);
    assertIdentifier(variable, 'variable name');
    const rows = getBindingsRows(engine, entity);
    const without = rows.filter(b => b.field !== field);
    writeBindingsRows(engine, entity, [...without, { field, variable }]);
  };
}

export default bindField;
