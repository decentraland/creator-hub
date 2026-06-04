import type { Entity, IEngine } from '@dcl/ecs';

import {
  getBindingsComponentOrNull,
  getBindingsRows,
  writeBindingsRows,
} from './ui-bindings-store';

export function unbindField(engine: IEngine) {
  return function unbindField(entity: Entity, field: string): void {
    if (!getBindingsComponentOrNull(engine)) return;
    const rows = getBindingsRows(engine, entity);
    writeBindingsRows(
      engine,
      entity,
      rows.filter(b => b.field !== field),
    );
  };
}

export default unbindField;
