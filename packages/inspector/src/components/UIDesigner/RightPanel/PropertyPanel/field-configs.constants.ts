import { flattenedToErgonomicPath } from '../../code/transform-patch';
import type { EnumOption, FieldKind } from './field-configs.types';

export const BINDS_VIA_OWN_CONTROL = false;
export const BINDS_VIA_PRIMARY_ROW_ONLY = false;

export const TRANSFORM = 'core::UiTransform';
export const BACKGROUND = 'core::UiBackground';

const BACKGROUND_BINDABLE_PATHS = new Set([
  'color',
  'textureMode',
  'texture.src',
  'avatarTexture.userId',
]);

/** Which code-mode variable types a field kind can bind to; a kind absent here is not bindable at all. */
export const KIND_TO_CODE_TYPES: Partial<Record<FieldKind, string[]>> = {
  string: ['string', 'number', 'boolean'],
  number: ['number'],
  length: ['number'],
  index: ['number'],
  boolean: ['boolean'],
  enum: ['string'],
  'position-mode': ['string'],
  'overflow-scroll': ['string'],
  'overflow-clip': ['string'],
  'text-align': ['string'],
  'text-wrap': ['string'],
  color: ['Color4'],
  fill: ['Color4'],
  'string-array': ['string[]'],
};

/** The prop path a field's binding is written to and read back from. */
export function bindPathFor(field: { path: string; writeAll?: string[] }): string {
  if (!field.writeAll) return field.path;
  return flattenedToErgonomicPath(field.path)?.group ?? field.path;
}

/** Whether a prop can carry a binding that round-trips to source and back. */
export function isBindableProp(field: {
  componentId: string;
  path: string;
  kind: FieldKind;
  strictTypes?: string[];
  writeAll?: string[];
}): boolean {
  if (!field.strictTypes && !KIND_TO_CODE_TYPES[field.kind]) return false;
  const path = bindPathFor(field);
  if (field.componentId === TRANSFORM) {
    return !!path && flattenedToErgonomicPath(path) !== null;
  }
  if (field.componentId === BACKGROUND) return BACKGROUND_BINDABLE_PATHS.has(path);
  return true;
}
export const TEXT = 'core::UiText';
export const INPUT = 'core::UiInput';
export const DROPDOWN = 'core::UiDropdown';
export const UI_EVENTS = 'ui::events';

export const FLEX_DIRECTION_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Row' },
  { value: 1, label: 'Column' },
  { value: 2, label: 'Column reverse' },
  { value: 3, label: 'Row reverse' },
];

export const JUSTIFY_CONTENT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex start' },
  { value: 1, label: 'Center' },
  { value: 2, label: 'Flex end' },
  { value: 3, label: 'Space between' },
  { value: 4, label: 'Space around' },
  { value: 5, label: 'Space evenly' },
];

export const ALIGN_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'Flex start' },
  { value: 2, label: 'Center' },
  { value: 3, label: 'Flex end' },
  { value: 4, label: 'Stretch' },
  { value: 5, label: 'Baseline' },
  { value: 6, label: 'Space between' },
  { value: 7, label: 'Space around' },
];

export const DISPLAY_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex' },
  { value: 1, label: 'None' },
];

export const FLEX_WRAP_OPTIONS: EnumOption[] = [
  { value: 0, label: 'No wrap' },
  { value: 1, label: 'Wrap' },
  { value: 2, label: 'Wrap reverse' },
];

export const FONT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Sans serif' },
  { value: 1, label: 'Serif' },
  { value: 2, label: 'Monospace' },
];

export const TEXTURE_MODE_OPTIONS: EnumOption[] = [
  { value: 1, label: 'Crop' },
  { value: 0, label: 'Sliced' },
  { value: 2, label: 'Stretched' },
];
