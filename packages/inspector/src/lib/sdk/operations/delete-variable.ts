import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

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
      const next = bindings.value.filter(b => b.variable !== name);
      if (next.length === bindings.value.length) continue;
      Bindings.createOrReplace(desc, { value: next });
    }
  };
}

export default deleteVariable;
