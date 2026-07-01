import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIVariable } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import { assertIdentifier } from './validators';

export function declareVariable(engine: IEngine) {
  return function declareVariable(uiRoot: Entity, variable: UIVariable): void {
    assertIdentifier(variable.name, 'variable name');
    const UIComp = engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    const current = UIComp.getOrNull(uiRoot);
    if (!current) return;
    if (current.variables.some(v => v.name === variable.name)) return;
    UIComp.createOrReplace(uiRoot, {
      ...current,
      variables: [...current.variables, variable],
    });
  };
}

export default declareVariable;
