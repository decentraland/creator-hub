import type { UINodeType } from './tree-model';

// PB enum values are `const enum`s; importing them at runtime is risky across
// module boundaries (they're erased at compile time). Hard-code the numeric
// values here with comments — the mappings are the stable wire-format constants
// defined in node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/{ui_transform,common/texts}.gen.d.ts.

// `length` writes the flat pair (value: number, valueUnit: YGUnit) — sibling
// fields on PBUiTransform — NOT a discriminated union `{ type, value }`.
// `length-vec` packs N length sub-fields into one dense row with leftLabels
// (TransformInspector style). `quad-pixels` is the same but assumes px units
// and skips the unit dropdown — used for padding/margin where px is the norm.
export type FieldKind =
  | 'length'
  | 'length-vec'
  | 'quad-pixels'
  | 'number'
  | 'string'
  | 'color'
  | 'enum'
  | 'boolean'
  | 'string-array'
  | 'index'
  | 'callback';

export interface EnumOption {
  value: number;
  label: string;
}

export interface VecSubField {
  path: string;
  leftLabel: string;
}

export interface FieldConfig {
  label: string;
  componentId: string;
  // For `length`: the *base* field name (without `Unit` suffix). e.g. 'width'
  // writes to both `width` and `widthUnit`.
  // For `length-vec` / `quad-pixels`: ignored; see `subFields`.
  // For all other kinds: the top-level key of the component value.
  path: string;
  kind: FieldKind;
  options?: EnumOption[];
  // For `length-vec` / `quad-pixels`: side-by-side sub-fields inside one Block.
  subFields?: VecSubField[];
  /**
   * Whether this field can be bound to a declared UI variable. Defaults to true.
   * Composite kinds (`length`, `length-vec`, `quad-pixels`) and enum/index
   * kinds set this to false in V1 — they have no scalar variable-type counterpart.
   */
  bindable?: boolean;
}

export interface NodeFieldConfig {
  groups: { title: string; fields: FieldConfig[] }[];
}

const TRANSFORM = 'core::UiTransform';
const BACKGROUND = 'core::UiBackground';
const TEXT = 'core::UiText';
const INPUT = 'core::UiInput';
const DROPDOWN = 'core::UiDropdown';
const UI_MARKER = 'asset-packs::UI';
const NAME = 'core-schema::Name';

// Shown at the top of the property panel ONLY when the selected entity has
// the `asset-packs::UI` marker — i.e. when editing a UI root. (Visible
// lives at the top of the Layout group instead — see `LAYOUT_VISIBLE_FIELD`.)
export const UI_ROOT_GROUP = {
  title: 'UI',
  fields: [{ label: 'Name', componentId: UI_MARKER, path: 'name', kind: 'string' as const }],
};

// Shown at the top of the property panel for child UI nodes (non-root).
// `Name.value` is what `generateEntityNamesType` reads to emit the constant
// in `entity-names.ts`, so editing this is how creators expose a node to
// scene code (e.g. `import { ScoreText } from './entity-names'`).
export const NODE_GROUP = {
  title: 'Node',
  fields: [{ label: 'Name', componentId: NAME, path: 'value', kind: 'string' as const }],
};

// Pinned at the top of the Layout group for UI roots only — same component
// as the UI marker, conceptually a layout/visibility toggle.
export const LAYOUT_VISIBLE_FIELD = {
  label: 'Visible',
  componentId: UI_MARKER,
  path: 'visible',
  kind: 'boolean' as const,
};

// YGFlexDirection
const FLEX_DIRECTION_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Row' },
  { value: 1, label: 'Column' },
  { value: 2, label: 'Column reverse' },
  { value: 3, label: 'Row reverse' },
];

// YGJustify
const JUSTIFY_CONTENT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex start' },
  { value: 1, label: 'Center' },
  { value: 2, label: 'Flex end' },
  { value: 3, label: 'Space between' },
  { value: 4, label: 'Space around' },
  { value: 5, label: 'Space evenly' },
];

// YGAlign — covers alignItems / alignSelf / alignContent.
const ALIGN_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'Flex start' },
  { value: 2, label: 'Center' },
  { value: 3, label: 'Flex end' },
  { value: 4, label: 'Stretch' },
  { value: 5, label: 'Baseline' },
  { value: 6, label: 'Space between' },
  { value: 7, label: 'Space around' },
];

// YGPositionType
const POSITION_TYPE_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Relative' },
  { value: 1, label: 'Absolute' },
];

// YGDisplay
const DISPLAY_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex' },
  { value: 1, label: 'None' },
];

// TextAlignMode — 9-value combined vertical+horizontal.
const TEXT_ALIGN_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Top left' },
  { value: 1, label: 'Top center' },
  { value: 2, label: 'Top right' },
  { value: 3, label: 'Middle left' },
  { value: 4, label: 'Middle center' },
  { value: 5, label: 'Middle right' },
  { value: 6, label: 'Bottom left' },
  { value: 7, label: 'Bottom center' },
  { value: 8, label: 'Bottom right' },
];

// --- Layout group building blocks ---
//
// Order requirements (per content team feedback):
//   Visible (roots only) → Display → Flex direction → Justify → Align items
//   → Size → Position type → Position → Padding → Margin
//
// Display/Flex/Justify/Align are CONTAINER-only — they only meaningfully
// affect a node that *contains* children, so they're hidden on leaves
// (Label / Button / Input / Dropdown). The PropertyPanel composes the
// final Layout group from these pieces per node type.

const LAYOUT_FLEX_FIELDS: FieldConfig[] = [
  {
    label: 'Display',
    componentId: TRANSFORM,
    path: 'display',
    kind: 'enum' as const,
    options: DISPLAY_OPTIONS,
    bindable: false,
  },
  {
    label: 'Flex direction',
    componentId: TRANSFORM,
    path: 'flexDirection',
    kind: 'enum' as const,
    options: FLEX_DIRECTION_OPTIONS,
    bindable: false,
  },
  {
    label: 'Justify content',
    componentId: TRANSFORM,
    path: 'justifyContent',
    kind: 'enum' as const,
    options: JUSTIFY_CONTENT_OPTIONS,
    bindable: false,
  },
  {
    label: 'Align items',
    componentId: TRANSFORM,
    path: 'alignItems',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
  },
];

const LAYOUT_BOX_FIELDS: FieldConfig[] = [
  {
    label: 'Size',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'width', leftLabel: 'W' },
      { path: 'height', leftLabel: 'H' },
    ],
    bindable: false,
  },
  {
    label: 'Position type',
    componentId: TRANSFORM,
    path: 'positionType',
    kind: 'enum' as const,
    options: POSITION_TYPE_OPTIONS,
    bindable: false,
  },
  {
    label: 'Position',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'positionTop', leftLabel: 'T' },
      { path: 'positionRight', leftLabel: 'R' },
      { path: 'positionBottom', leftLabel: 'B' },
      { path: 'positionLeft', leftLabel: 'L' },
    ],
    bindable: false,
  },
  {
    label: 'Padding',
    componentId: TRANSFORM,
    path: '',
    kind: 'quad-pixels' as const,
    subFields: [
      { path: 'paddingTop', leftLabel: 'T' },
      { path: 'paddingRight', leftLabel: 'R' },
      { path: 'paddingBottom', leftLabel: 'B' },
      { path: 'paddingLeft', leftLabel: 'L' },
    ],
    bindable: false,
  },
  {
    label: 'Margin',
    componentId: TRANSFORM,
    path: '',
    kind: 'quad-pixels' as const,
    subFields: [
      { path: 'marginTop', leftLabel: 'T' },
      { path: 'marginRight', leftLabel: 'R' },
      { path: 'marginBottom', leftLabel: 'B' },
      { path: 'marginLeft', leftLabel: 'L' },
    ],
    bindable: false,
  },
];

/**
 * Compose the Layout group for a given node type.
 * @param isRoot prepend the Visible toggle (only roots have the marker).
 * @param isContainer include the flex-layout fields (only UiEntity nodes).
 */
export function buildLayoutGroup(isRoot: boolean, isContainer: boolean) {
  const fields: FieldConfig[] = [];
  if (isRoot) fields.push(LAYOUT_VISIBLE_FIELD);
  if (isContainer) fields.push(...LAYOUT_FLEX_FIELDS);
  fields.push(...LAYOUT_BOX_FIELDS);
  return { title: 'Layout', fields };
}

const BACKGROUND_GROUP = {
  title: 'Background',
  fields: [{ label: 'Color', componentId: BACKGROUND, path: 'color', kind: 'color' as const }],
};

const TEXT_GROUP = {
  title: 'Text',
  fields: [
    { label: 'Value', componentId: TEXT, path: 'value', kind: 'string' as const },
    { label: 'Color', componentId: TEXT, path: 'color', kind: 'color' as const },
    { label: 'Font size', componentId: TEXT, path: 'fontSize', kind: 'number' as const },
    {
      label: 'Text align',
      componentId: TEXT,
      path: 'textAlign',
      kind: 'enum' as const,
      options: TEXT_ALIGN_OPTIONS,
      bindable: false,
    },
  ],
};

const INPUT_GROUP = {
  title: 'Input',
  fields: [
    { label: 'Placeholder', componentId: INPUT, path: 'placeholder', kind: 'string' as const },
    { label: 'Value', componentId: INPUT, path: 'value', kind: 'string' as const },
    { label: 'Disabled', componentId: INPUT, path: 'disabled', kind: 'boolean' as const },
  ],
};

const DROPDOWN_GROUP = {
  title: 'Dropdown',
  fields: [
    { label: 'Options', componentId: DROPDOWN, path: 'options', kind: 'string-array' as const },
    {
      label: 'Selected index',
      componentId: DROPDOWN,
      path: 'selectedIndex',
      kind: 'index' as const,
      bindable: false,
    },
  ],
};

const BUTTON_EVENTS_GROUP = {
  title: 'Events',
  fields: [
    {
      label: 'On mouse down',
      componentId: UI_MARKER,
      path: 'onMouseDown',
      kind: 'callback' as const,
    },
    {
      label: 'On mouse up',
      componentId: UI_MARKER,
      path: 'onMouseUp',
      kind: 'callback' as const,
    },
  ],
};

const INPUT_EVENTS_GROUP = {
  title: 'Events',
  fields: [
    { label: 'On change', componentId: INPUT, path: 'onChange', kind: 'callback' as const },
    { label: 'On submit', componentId: INPUT, path: 'onSubmit', kind: 'callback' as const },
  ],
};

const DROPDOWN_EVENTS_GROUP = {
  title: 'Events',
  fields: [
    { label: 'On change', componentId: DROPDOWN, path: 'onChange', kind: 'callback' as const },
  ],
};

// Per-node-type extra groups. The Layout group is composed dynamically by
// `buildLayoutGroup` in PropertyPanel and is NOT listed here — that keeps
// the field-order and root/container variants in one place.
export const NODE_FIELD_CONFIGS: Record<UINodeType, NodeFieldConfig> = {
  UiEntity: { groups: [BACKGROUND_GROUP] },
  Label: { groups: [BACKGROUND_GROUP, TEXT_GROUP] },
  Button: { groups: [BACKGROUND_GROUP, TEXT_GROUP, BUTTON_EVENTS_GROUP] },
  Input: { groups: [INPUT_GROUP, INPUT_EVENTS_GROUP] },
  Dropdown: { groups: [DROPDOWN_GROUP, DROPDOWN_EVENTS_GROUP] },
};
