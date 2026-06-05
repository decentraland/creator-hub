import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI } from '@dcl/asset-packs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

import { collectDescendants } from './tree-walk';
import { assertIdentifier } from './validators';
import {
  getBindingsComponentOrNull,
  getBindingsRows,
  writeBindingsRows,
} from './ui-bindings-store';

export function deleteVariable(engine: IEngine) {
  return function deleteVariable(uiRoot: Entity, name: string): void {
    assertIdentifier(name, 'variable name');
    const UIComp = engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    const current = UIComp.getOrNull(uiRoot);
    if (!current) return;
    UIComp.createOrReplace(uiRoot, {
      ...current,
      variables: current.variables.filter(v => v.name !== name),
    });

    if (!getBindingsComponentOrNull(engine)) return;
    for (const desc of collectDescendants(engine, uiRoot)) {
      if (desc === uiRoot) continue;
      const rows = getBindingsRows(engine, desc);
      if (rows.length === 0) continue;
      let changed = false;
      const next = rows
        .map(b => {
          if (b.variable === name && !b.segments?.length) {
            changed = true;
            return null;
          }
          if (b.segments?.length) {
            const segments = b.segments.filter(
              seg => !(seg.kind === SegmentKind.BINDING && seg.value === name),
            );
            if (segments.length !== b.segments.length) {
              changed = true;
              return segments.length > 0 ? { ...b, segments } : null;
            }
          }
          return b;
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
      if (changed) writeBindingsRows(engine, desc, next);
    }
  };
}

export default deleteVariable;
