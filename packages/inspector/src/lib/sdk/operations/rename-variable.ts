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
      writeBindingsRows(
        engine,
        desc,
        rows.map(b => ({
          ...b,
          variable: b.variable === oldName ? newName : b.variable,
          ...(b.segments
            ? {
                segments: b.segments.map(seg =>
                  seg.kind === SegmentKind.BINDING && seg.value === oldName
                    ? { ...seg, value: newName }
                    : seg,
                ),
              }
            : {}),
        })),
      );
    }
  };
}

export default renameVariable;
