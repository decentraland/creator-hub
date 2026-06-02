import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';
import { UiTransform as UiTransformEngine } from '@dcl/ecs';
import type { UI, UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

function collectDescendants(engine: IEngine, root: Entity): Set<Entity> {
  const UiTransform = engine.getComponent(
    UiTransformEngine.componentName,
  ) as LastWriteWinElementSetComponentDefinition<PBUiTransform>;
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of engine.getEntitiesWith(UiTransform)) {
    const parent = (value as unknown as { parent?: Entity }).parent;
    if (parent === undefined) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(entity);
    childrenOf.set(parent, list);
  }
  const out = new Set<Entity>();
  const stack: Entity[] = [root];
  while (stack.length) {
    const e = stack.pop()!;
    if (out.has(e)) continue;
    out.add(e);
    for (const c of childrenOf.get(e) ?? []) stack.push(c);
  }
  return out;
}

export function renameVariable(engine: IEngine) {
  return function renameVariable(uiRoot: Entity, oldName: string, newName: string): void {
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
        value: bindings.value.map(b => (b.variable === oldName ? { ...b, variable: newName } : b)),
      });
    }
  };
}

export default renameVariable;
