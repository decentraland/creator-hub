import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIBindings } from '@dcl/asset-packs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

import { collectDescendants } from './tree-walk';

export function deleteVariable(engine: IEngine) {
  return function deleteVariable(uiRoot: Entity, name: string): void {
    const UIComp = engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    const current = UIComp.getOrNull(uiRoot);
    if (!current) return;
    UIComp.createOrReplace(uiRoot, {
      ...current,
      variables: current.variables.filter(v => v.name !== name),
    });

    const Bindings = engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    if (!Bindings) return;
    for (const desc of collectDescendants(engine, uiRoot)) {
      if (desc === uiRoot) continue;
      const bindings = Bindings.getOrNull(desc);
      if (!bindings) continue;
      let changed = false;
      const next = bindings.value
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
      if (changed) Bindings.createOrReplace(desc, { value: next as UIBindings['value'] });
    }
  };
}

export default deleteVariable;
