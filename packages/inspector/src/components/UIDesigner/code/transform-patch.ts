import { type Edit, setObjectFields } from './emit-adapter';
import { pbToErgonomicTransform } from './ecs-shape';

// The PropertyPanel patches flattened PBUiTransform fields (width + widthUnit,
// positionTop + positionTopUnit, borderTopLeftRadius…, positionType, opacity…).
// Turn such a patch into SURGICAL per-field edits on the ergonomic
// `uiTransform={{ … }}` object: only the ergonomic keys the patch actually
// touches are written (or removed when the patched value resolves to unset) —
// every other key in the source object, including ones the editor doesn't
// model, is left byte-for-byte intact. This is what keeps a panel edit from
// erasing hand-authored props (the audit's P0 finding: the previous
// whole-attribute re-emit destroyed `opacity`/`zIndex`/bindings/spreads).

interface AstElement {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

// Map one flattened-PB patch key to the ergonomic uiTransform key it lives in.
// Returns null for keys that never reach source (the structural `parent`).
export function flattenedToErgonomicKey(key: string): string | null {
  if (key === 'parent' || key === 'rightOf') return null;
  const base = key.endsWith('Unit') ? key.slice(0, -4) : key;
  if (/^border[A-Z][A-Za-z]*Radius$/.test(base)) return 'borderRadius';
  if (/^border[A-Z][a-z]+Width$/.test(base)) return 'borderWidth';
  if (/^border[A-Z][a-z]+Color$/.test(base)) return 'borderColor';
  if (base === 'positionType') return 'positionType';
  if (/^position[A-Z]/.test(base)) return 'position';
  if (/^margin[A-Z]/.test(base)) return 'margin';
  if (/^padding[A-Z]/.test(base)) return 'padding';
  return base;
}

// The ergonomic `uiTransform` fields a panel patch resolves to — the sink-agnostic
// half of uiTransformPatchEdits, shared with the interaction-layer write path (an
// interaction state's `uiTransform` lives in an object literal, not a JSX
// attribute). `currentPB` is the node's current flattened-PB uiTransform
// (parse-adapter output), merged with the patch so group re-folds (an edge
// object, a border group) keep their untouched members. A field resolving to
// `undefined` means "remove it" to the setObjectFields family — exactly right
// when a patched value becomes unset (switching back to in-flow clears the
// position edges; positionType folds away when relative).
export function uiTransformPatchFields(
  currentPB: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const touched = new Set<string>();
  for (const key of Object.keys(patch)) {
    const ergoKey = flattenedToErgonomicKey(key);
    if (ergoKey) touched.add(ergoKey);
  }
  if (touched.size === 0) return {};

  const merged: Record<string, unknown> = { ...currentPB, ...patch };
  delete merged.parent;
  const ergo = pbToErgonomicTransform(merged);

  const fields: Record<string, unknown> = {};
  for (const key of touched) fields[key] = ergo[key];
  return fields;
}

// Build the edits for a panel patch against the node's backing JSX element.
export function uiTransformPatchEdits(
  el: AstElement,
  currentPB: Record<string, unknown>,
  patch: Record<string, unknown>,
): Edit[] {
  const fields = uiTransformPatchFields(currentPB, patch);
  if (Object.keys(fields).length === 0) return [];
  return setObjectFields(el, 'uiTransform', fields);
}
