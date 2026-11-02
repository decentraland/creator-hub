import { type Edit, raw, setObjectFields } from './emit-adapter';
import { pbToErgonomicTransform } from './ecs-shape';

interface AstElement {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

/** Where one flattened-PB patch key lives in the ergonomic `uiTransform` object (its key, plus a member for per-edge/corner groups); null for keys that never reach source. */
export function flattenedToErgonomicPath(key: string): { group: string; member?: string } | null {
  if (key === 'parent' || key === 'rightOf') return null;
  const base = key.endsWith('Unit') ? key.slice(0, -4) : key;
  const lower = (s: string) => s[0].toLowerCase() + s.slice(1);

  const radius = /^border([A-Z][A-Za-z]*)Radius$/.exec(base);
  if (radius) return { group: 'borderRadius', member: lower(radius[1]) };
  const width = /^border([A-Z][a-z]+)Width$/.exec(base);
  if (width) return { group: 'borderWidth', member: lower(width[1]) };
  const color = /^border([A-Z][a-z]+)Color$/.exec(base);
  if (color) return { group: 'borderColor', member: lower(color[1]) };

  if (base === 'positionType') return { group: 'positionType' };
  for (const group of ['position', 'margin', 'padding']) {
    const m = new RegExp(`^${group}([A-Z][a-z]+)$`).exec(base);
    if (m) return { group, member: lower(m[1]) };
  }
  return { group: base };
}

/** Map one flattened-PB patch key to the ergonomic uiTransform key it lives in. */
export function flattenedToErgonomicKey(key: string): string | null {
  return flattenedToErgonomicPath(key)?.group ?? null;
}

/** The ergonomic uiTransform keys that hold a per-edge / per-corner object, addressed by a nested key. */
export const NESTED_TRANSFORM_GROUPS = new Set([
  'position',
  'margin',
  'padding',
  'borderRadius',
  'borderWidth',
  'borderColor',
]);

const BORDER_SUFFIX: Record<string, string> = {
  borderRadius: 'Radius',
  borderWidth: 'Width',
  borderColor: 'Color',
};

/** Inverse of flattenedToErgonomicPath for a nested member: the flattened PB key a group member addresses, or null. */
export function ergonomicToFlattenedKey(group: string, member: string): string | null {
  if (!NESTED_TRANSFORM_GROUPS.has(group) || !member) return null;
  const cap = member[0].toUpperCase() + member.slice(1);
  const suffix = BORDER_SUFFIX[group];
  return suffix ? `border${cap}${suffix}` : `${group}${cap}`;
}

/** The ergonomic `uiTransform` fields a panel patch resolves to (sink-agnostic); merges `currentPB` with the patch and re-injects `bound` keys raw. */
export function uiTransformPatchFields(
  currentPB: Record<string, unknown>,
  patch: Record<string, unknown>,
  bound?: Record<string, string>,
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

  for (const [flat, expr] of Object.entries(bound ?? {})) {
    const at = flattenedToErgonomicPath(flat);
    if (!at || !touched.has(at.group)) continue;
    if (!at.member) {
      fields[at.group] = raw(expr);
      continue;
    }
    const current = fields[at.group];
    const bag =
      current && typeof current === 'object' && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : {};
    bag[at.member] = raw(expr);
    fields[at.group] = bag;
  }
  return fields;
}

const TRANSFORM_BINDING_PREFIX = 'core::UiTransform.';

/** A node's bound uiTransform keys, flattened-PB path → expression; mixed-content rows are skipped. */
export function boundTransformKeys(
  bindings: { field: string; variable: string }[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of bindings ?? []) {
    if (!b.variable || !b.field.startsWith(TRANSFORM_BINDING_PREFIX)) continue;
    out[b.field.slice(TRANSFORM_BINDING_PREFIX.length)] = b.variable;
  }
  return out;
}

/** Build the edits for a panel patch against the node's backing JSX element. */
export function uiTransformPatchEdits(
  el: AstElement,
  currentPB: Record<string, unknown>,
  patch: Record<string, unknown>,
  bound?: Record<string, string>,
): Edit[] {
  const fields = uiTransformPatchFields(currentPB, patch, bound);
  if (Object.keys(fields).length === 0) return [];
  return setObjectFields(el, 'uiTransform', fields);
}
