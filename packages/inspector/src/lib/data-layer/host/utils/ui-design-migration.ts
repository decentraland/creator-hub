import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName } from '@dcl/asset-packs';

type Lww = LastWriteWinElementSetComponentDefinition<unknown>;

// Inspector-only: the composite persists UI Designer nodes as asset-packs::UIDesign (see
// engine-to-composite.ts). After load, split each UIDesign back into the live core::*
// render components the editor reads/writes, then drop UIDesign. The Explorer never runs
// this — its runtime consumes UIDesign directly.
export function splitUIDesignToCore(engine: IEngine): void {
  const UIDesign = engine.getComponentOrNull(ComponentName.UI_DESIGN) as Lww | null;
  if (!UIDesign) return;
  const UiTransform = engine.getComponent('core::UiTransform') as Lww;
  const UiText = engine.getComponent('core::UiText') as Lww;
  const UiInput = engine.getComponent('core::UiInput') as Lww;
  const UiDropdown = engine.getComponent('core::UiDropdown') as Lww;

  for (const [entity, design] of engine.getEntitiesWith(UIDesign)) {
    const d = design as {
      parent?: number;
      rightOf?: number;
      transform?: string;
      text?: string;
      input?: string;
      dropdown?: string;
    };
    const transform = {
      ...(d.transform ? JSON.parse(d.transform) : {}),
      parent: d.parent ?? 0,
      rightOf: d.rightOf ?? 0,
    };
    UiTransform.createOrReplace(entity, transform);
    if (d.text) UiText.createOrReplace(entity, JSON.parse(d.text));
    if (d.input) UiInput.createOrReplace(entity, JSON.parse(d.input));
    if (d.dropdown) UiDropdown.createOrReplace(entity, JSON.parse(d.dropdown));
    UIDesign.deleteFrom(entity);
  }
}
