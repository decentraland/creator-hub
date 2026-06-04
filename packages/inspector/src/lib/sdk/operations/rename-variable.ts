import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIBindings } from '@dcl/asset-packs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

import { collectDescendants } from './tree-walk';
import { assertIdentifier } from './validators';

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

    const Bindings = engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    if (!Bindings) return;
    for (const desc of collectDescendants(engine, uiRoot)) {
      if (desc === uiRoot) continue;
      const bindings = Bindings.getOrNull(desc);
      if (!bindings) continue;
      Bindings.createOrReplace(desc, {
        value: bindings.value.map(b => ({
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
        })) as UIBindings['value'],
      });
    }
  };
}

export default renameVariable;
