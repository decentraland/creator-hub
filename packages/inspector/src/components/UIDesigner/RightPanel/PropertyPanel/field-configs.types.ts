export type FieldKind =
  | 'length'
  | 'length-vec'
  | 'number'
  | 'string'
  | 'color'
  | 'enum'
  | 'boolean'
  | 'string-array'
  | 'index'
  | 'callback'
  | 'fill'
  | 'text-align'
  | 'text-wrap'
  | 'align-preset'
  | 'position-mode'
  | 'flow'
  | 'alignment'
  | 'resize'
  | 'overflow-scroll'
  | 'overflow-clip'
  | 'box-model'
  | 'uv-region'
  | 'border-rect';

export interface EnumOption {
  value: number;
  label: string;
}

export interface VecSubField {
  path: string;
  leftLabel: string;
}

export interface FieldConfig {
  label?: string;
  componentId: string;
  path: string;
  kind: FieldKind;
  options?: EnumOption[];
  subFields?: VecSubField[];
  /** For a `length-vec` that shows fewer cells than it stores: which sub-fields to render for a given component value. */
  facadeSubFields?: (componentValue: Record<string, unknown> | null) => VecSubField[];
  /** For the Size `length-vec`: render an aspect-ratio lock toggle constraining width/height to their current ratio on edit. */
  aspectLockable?: boolean;
  /** For a `number` field whose UI unit is not the SDK prop's: the pair converting between them (must be exact inverses). */
  toDisplay?: (sourceValue: number) => number;
  fromDisplay?: (displayValue: number) => number;
  /** A fixed unit glyph inside the input, right-aligned, for a field whose unit can never vary. */
  suffix?: string;
  /** Render this row at half width so it pairs with the adjacent half-width row. */
  half?: boolean;
  /** Whether this field can be bound to a declared UI variable. Defaults to true. */
  bindable?: boolean;
  /** Whether this string field uses the inline mixed-content editor (literal text interleaved with variable chips). */
  mixable?: boolean;
  /** When set, this single control writes its value to EVERY listed path (and the matching `${path}Unit`); reads from `path`. */
  writeAll?: string[];
  /** When this returns true for the field's component value, the control is rendered disabled/greyed. */
  disabledWhen?: (componentValue: Record<string, unknown>) => boolean;
  /** Describes how the node sits in its PARENT, so it has no meaning on a UI root; the panel checks this flag where it knows the selected node. */
  hideOnRoot?: boolean;
  /** When this returns true for the field's component value, the field's ROW is not rendered (vs `disabledWhen` which greys it). */
  hiddenWhen?: (componentValue: Record<string, unknown>) => boolean;
  /** When set, the raw input value is passed through this before being written. Only consulted for `kind: 'string'`. */
  sanitize?: (value: string) => string;
  /** Exact variable types the VariablePicker may offer for this field, overriding the kind-based coercion table. */
  strictTypes?: string[];
  /** One-line help shown as a hover tooltip beside the field label. */
  info?: string;
  /** For `box-model`: which edge box the row renders — `padding` or `margin`. */
  box?: 'padding' | 'margin';
  /** Always shown in the panel — the curated baseline for its group; optional fields without it are hidden until set. */
  core?: boolean;
  /** Draw an unset optional prop as a label plus a `+` on its own line, instead of hiding it inside the group's `+ Add property` menu. */
  inlineAdd?: boolean;
  /** Extra props seeded alongside this one when it is added, for a field whose kind-based seed alone would leave the new rows inert. */
  addAlso?: Record<string, unknown>;
  /** For `enum`/`number` fields whose in-world default is not the zero value: the value the control shows when the prop is unset. */
  defaultValue?: number;
}

export interface NodeFieldConfig {
  groups: { title: string; fields: FieldConfig[] }[];
}
