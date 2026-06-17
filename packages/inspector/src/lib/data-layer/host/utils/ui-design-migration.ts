import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName } from '@dcl/asset-packs';

type Lww = LastWriteWinElementSetComponentDefinition<unknown>;

// Inspector-only: the composite persists UI Designer nodes as asset-packs::UIDesign (see
// engine-to-composite.ts). After load, split each UIDesign back into the live core::*
// render components the editor reads/writes, then drop UIDesign. The Explorer never runs
// this — its runtime consumes UIDesign directly.
// The composite JSON is attacker-controllable; a malformed UIDesign string field must not
// abort the whole scene load. Parse defensively: on failure log the offending entity and
// fall back, so one bad node is skipped rather than throwing out of runMigrations().
function safeParse<T>(raw: string | undefined, fallback: T, entity: number, field: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(
      `splitUIDesignToCore: malformed UIDesign.${field} on entity ${entity}; using fallback`,
    );
    return fallback;
  }
}

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
      ...safeParse<Record<string, unknown>>(d.transform, {}, entity, 'transform'),
      parent: d.parent ?? 0,
      rightOf: d.rightOf ?? 0,
    };
    UiTransform.createOrReplace(entity, transform);
    const text = safeParse<Record<string, unknown> | undefined>(d.text, undefined, entity, 'text');
    if (text) UiText.createOrReplace(entity, text);
    const input = safeParse<Record<string, unknown> | undefined>(
      d.input,
      undefined,
      entity,
      'input',
    );
    if (input) UiInput.createOrReplace(entity, input);
    const dropdown = safeParse<Record<string, unknown> | undefined>(
      d.dropdown,
      undefined,
      entity,
      'dropdown',
    );
    if (dropdown) UiDropdown.createOrReplace(entity, dropdown);
    UIDesign.deleteFrom(entity);
  }
}
