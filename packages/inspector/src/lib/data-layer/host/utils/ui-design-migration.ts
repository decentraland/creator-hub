import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName } from '@dcl/asset-packs';

type Lww = LastWriteWinElementSetComponentDefinition<unknown>;

// Inspector-only: the composite persists UI Designer nodes as asset-packs::UIDesign (see
// engine-to-composite.ts). After load, split each UIDesign back into the live core::*
// render components the editor reads/writes, then drop UIDesign. The Explorer never runs
// this — its runtime consumes UIDesign directly.
// Keys an attacker could place in composite JSON to attempt prototype pollution; stripped from
// every decoded object before it reaches createOrReplace. Variable-key delete avoids the
// linter's no-proto literal-access rule. Keep IN LOCKSTEP with the copy in
// packages/asset-packs/src/ui-runtime.ts.
const DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'];

// The composite JSON is attacker-controllable; a malformed UIDesign string field must not abort
// the whole scene load, nor reach a core::* component as a wrong-shape value or with
// prototype-polluting keys. Parse defensively: on throw OR non-plain-object shape, log the
// offending entity and fall back; otherwise strip dangerous keys and return. exported for tests.
export function safeParse<T>(
  raw: string | undefined,
  fallback: T,
  entity: number,
  field: string,
): T {
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(
      `splitUIDesignToCore: malformed UIDesign.${field} on entity ${entity}; using fallback`,
    );
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn(
      `splitUIDesignToCore: non-object UIDesign.${field} on entity ${entity}; using fallback`,
    );
    return fallback;
  }
  const obj = parsed as Record<string, unknown>;
  for (const k of DANGEROUS_KEYS) delete obj[k];
  return obj as T;
}

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
    const background = safeParse<Record<string, unknown> | undefined>(
      d.background,
      undefined,
      entity,
      'background',
    );
    if (background) UiBackground.createOrReplace(entity, background);
    UIDesign.deleteFrom(entity);
  }
}
