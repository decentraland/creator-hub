import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName, safeParse } from '@dcl/asset-packs';

type Lww = LastWriteWinElementSetComponentDefinition<unknown>;

// Inspector-only: the composite persists UI Designer nodes as asset-packs::UIDesign (see
// engine-to-composite.ts). After load, split each UIDesign back into the live core::*
// render components the editor reads/writes, then drop UIDesign. The Explorer never runs
// this — its runtime consumes UIDesign directly.
//
// safeParse + the dangerous-key strip are shared with the runtime (asset-packs/safe-parse.ts);
// re-exported here so existing importers (and the spec) keep resolving it from this module.
export { safeParse } from '@dcl/asset-packs';

// Fallback logging for malformed composite-sourced UIDesign JSON (inspector load side).
const SPLIT_LOG = { label: 'splitUIDesignToCore', warn: (msg: string) => console.warn(msg) };

export function splitUIDesignToCore(engine: IEngine): void {
  const UIDesign = engine.getComponentOrNull(ComponentName.UI_DESIGN) as Lww | null;
  if (!UIDesign) return;
  const UiTransform = engine.getComponent('core::UiTransform') as Lww;
  const UiText = engine.getComponent('core::UiText') as Lww;
  const UiInput = engine.getComponent('core::UiInput') as Lww;
  const UiDropdown = engine.getComponent('core::UiDropdown') as Lww;
  const UiBackground = engine.getComponent('core::UiBackground') as Lww;

  for (const [entity, design] of engine.getEntitiesWith(UIDesign)) {
    const d = design as {
      parent?: number;
      rightOf?: number;
      transform?: string;
      text?: string;
      input?: string;
      dropdown?: string;
      background?: string;
    };
    const transform = {
      ...safeParse<Record<string, unknown>>(d.transform, {}, entity, 'transform', SPLIT_LOG),
      parent: d.parent ?? 0,
      rightOf: d.rightOf ?? 0,
    };
    UiTransform.createOrReplace(entity, transform);
    const text = safeParse<Record<string, unknown> | undefined>(
      d.text,
      undefined,
      entity,
      'text',
      SPLIT_LOG,
    );
    if (text) UiText.createOrReplace(entity, text);
    const input = safeParse<Record<string, unknown> | undefined>(
      d.input,
      undefined,
      entity,
      'input',
      SPLIT_LOG,
    );
    if (input) UiInput.createOrReplace(entity, input);
    const dropdown = safeParse<Record<string, unknown> | undefined>(
      d.dropdown,
      undefined,
      entity,
      'dropdown',
      SPLIT_LOG,
    );
    if (dropdown) UiDropdown.createOrReplace(entity, dropdown);
    const background = safeParse<Record<string, unknown> | undefined>(
      d.background,
      undefined,
      entity,
      'background',
      SPLIT_LOG,
    );
    if (background) UiBackground.createOrReplace(entity, background);
    UIDesign.deleteFrom(entity);
  }
}
