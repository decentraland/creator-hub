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

export function renameVariable(engine: IEngine) {
  return function renameVariable(uiRoot: Entity, oldName: string, newName: string): void {
    assertIdentifier(oldName, 'variable name');
    assertIdentifier(newName, 'variable name');
    if (oldName === newName) return;
    const UIComp = engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    const current = UIComp.getOrNull(uiRoot);
    if (!current) return;
    if (current.variables.some(v => v.name === newName)) return;
    UIComp.createOrReplace(uiRoot, {
      ...current,
      variables: current.variables.map(v => (v.name === oldName ? { ...v, name: newName } : v)),
    });

    if (!getBindingsComponentOrNull(engine)) return;
    for (const desc of collectDescendants(engine, uiRoot)) {
      if (desc === uiRoot) continue;
      const rows = getBindingsRows(engine, desc);
      if (rows.length === 0) continue;
      // Only rewrite this entity if a row actually references `oldName` — avoid
      // a no-op CRDT write for every bound entity on an unrelated rename.
      let changed = false;
      const next = rows.map(b => {
        const variable = b.variable === oldName ? newName : b.variable;
        if (variable !== b.variable) changed = true;
        if (!b.segments) {
          return variable !== b.variable ? { ...b, variable } : b;
        }
        let segChanged = false;
        const segments = b.segments.map(seg => {
          if (seg.kind === SegmentKind.BINDING && seg.value === oldName) {
            segChanged = true;
            return { ...seg, value: newName };
          }
          return seg;
        });
        if (segChanged) {
          changed = true;
          return { ...b, variable, segments };
        }
        return variable !== b.variable ? { ...b, variable } : b;
      });
      if (changed) writeBindingsRows(engine, desc, next);
    }
  };
}

export default renameVariable;
