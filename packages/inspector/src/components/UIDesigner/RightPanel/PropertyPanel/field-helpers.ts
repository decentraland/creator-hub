import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_PERCENT,
  YGU_POINT,
} from '../../../../lib/sdk/ui-transform-constants';
import { ALIGNMENTS } from './alignment-presets';
import type { FieldConfig } from './field-configs';

export type Color4 = { r: number; g: number; b: number; a?: number };

export const TW_WRAP = 0;
export const TW_NO_WRAP = 1;

export function clampNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function expandWriteAll(
  paths: string[],
  value: unknown,
  withUnit?: { unit: number },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of paths) {
    patch[p] = value;
    if (withUnit) patch[`${p}Unit`] = withUnit.unit;
  }
  return patch;
}

export const UNIT_OPTIONS = [
  { value: YGU_POINT, label: 'px' },
  { value: YGU_PERCENT, label: '%' },
];

export const ALIGNMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  ...ALIGNMENTS.map(a => {
    const [v, h] = a.split('-');
    return { value: a, label: `${v[0].toUpperCase()}${v.slice(1)} ${h}` };
  }),
];

export const TOGGLABLE_KINDS = new Set([
  'number',
  'index',
  'boolean',
  'string',
  'string-array',
  'color',
  'enum',
  'length',
  'length-vec',
  'position-mode',
]);

export function isTogglable(field: FieldConfig): boolean {
  return !field.core && TOGGLABLE_KINDS.has(field.kind);
}

export const CHECKBOX_KINDS = new Set([
  'boolean',
  'position-mode',
  'overflow-scroll',
  'overflow-clip',
  'text-wrap',
]);

export function fieldSetPaths(field: FieldConfig): string[] {
  if (field.writeAll) return field.writeAll;
  if (field.subFields) return field.subFields.map(s => s.path);
  return field.path ? [field.path] : [];
}

export function isFieldSet(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return fieldSetPaths(field).some(p => p in value);
}

/** Whether a field belongs in its group's `+ Add property` menu. */
export function isAddableField(
  field: FieldConfig,
  value: Record<string, unknown> | null,
  boundFields: ReadonlySet<string>,
): boolean {
  return (
    isTogglable(field) &&
    !field.inlineAdd &&
    !isFieldSet(field, value) &&
    !boundFields.has(`${field.componentId}.${field.path}`)
  );
}

/** Whether an inline-addable field shows its `+` stub rather than its control. */
export function isInlineStub(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  return !!field.inlineAdd && !isFieldSet(field, value);
}

export const isAbsolute = (value: Record<string, unknown> | null | undefined): boolean =>
  ((value?.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;

export function hiddenOnRoot(
  field: FieldConfig,
  isGuiRoot: boolean,
  value: Record<string, unknown> | null,
): boolean {
  if (!field.hideOnRoot || !isGuiRoot) return false;
  return !isAbsolute(value);
}

/** Whether to drop "Ignore Layout Flow" because the node's PARENT is itself absolutely positioned. */
export function hiddenUnderAbsoluteParent(
  parentInFlow: boolean,
  value: Record<string, unknown> | null,
): boolean {
  return !parentInFlow && !isAbsolute(value);
}

/** Seed patch written when the user ADDS an optional prop — a sensible default plus whatever `addAlso` declares. */
export function buildAddPatch(field: FieldConfig): Record<string, unknown> {
  return { ...seedPatch(field), ...field.addAlso };
}

export function seedPatch(field: FieldConfig): Record<string, unknown> {
  switch (field.kind) {
    case 'number':
      return { [field.path]: field.defaultValue ?? 0 };
    case 'index':
      return { [field.path]: 0 };
    case 'boolean':
      return { [field.path]: false };
    case 'string':
      return { [field.path]: '' };
    case 'string-array':
      return { [field.path]: [] };
    case 'enum':
    case 'position-mode':
      return { [field.path]: field.defaultValue ?? field.options?.[0]?.value ?? 0 };
    case 'color': {
      const black = { r: 0, g: 0, b: 0, a: 1 };
      return field.writeAll ? expandWriteAll(field.writeAll, black) : { [field.path]: black };
    }
    case 'length': {
      const seed = /width/i.test(field.path) ? 1 : 0;
      return field.writeAll
        ? expandWriteAll(field.writeAll, seed, { unit: YGU_POINT })
        : { [field.path]: seed, [`${field.path}Unit`]: YGU_POINT };
    }
    case 'length-vec': {
      const patch: Record<string, unknown> = {};
      for (const s of field.subFields ?? []) {
        patch[s.path] = 0;
        patch[`${s.path}Unit`] = YGU_POINT;
      }
      return patch;
    }
    default:
      return {};
  }
}

export function buildRemovePatch(field: FieldConfig): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of fieldSetPaths(field)) {
    patch[p] = undefined;
    patch[`${p}Unit`] = undefined;
  }
  for (const p of Object.keys(field.addAlso ?? {})) patch[p] = undefined;
  return patch;
}
