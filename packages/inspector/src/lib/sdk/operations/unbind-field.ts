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
    const next = rows.filter(b => b.field !== field);
    // The field wasn't bound — skip the createOrReplace so we don't emit a
    // no-op CRDT write (this fires on every literal-text commit in the editor).
    if (next.length === rows.length) return;
    writeBindingsRows(engine, entity, next);
  };
}

export default unbindField;
