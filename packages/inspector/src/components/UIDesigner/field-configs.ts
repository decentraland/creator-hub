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
  | 'callback'
  | 'texture';

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
  /**
   * Whether this string field uses the inline mixed-content editor (literal
   * text interleaved with variable chips). Only meaningful for `kind: 'string'`
   * renderable text fields (UiText.value, UiInput.value, UiInput.placeholder).
   * Identity fields (UI.name, Name.value) leave this false — they feed codegen
   * via `sanitizeIdentifier` and must stay plain.
   */
  mixable?: boolean;
  /**
   * When set, this single control writes its value to EVERY listed path (and,
   * for `length`/`number`, the matching `${path}Unit`). Reads from `path`.
   * Used for "one corner radius → all 4 corners", border width/color, etc.
   */
  writeAll?: string[];
  /**
   * When this returns true (given the field's component value), the control is
   * rendered disabled/greyed. Pure read of the same component, e.g. margin is
   * disabled when positionType === Absolute (Yoga ignores it).
   */
  disabledWhen?: (componentValue: Record<string, unknown>) => boolean;
  /** One-line help shown as a hover tooltip beside the field label. */
  info?: string;
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
  fields: [
    { label: 'Name', componentId: UI_MARKER, path: 'name', kind: 'string' as const },
    {
      label: 'Canvas width',
      componentId: UI_MARKER,
      path: 'canvasWidth',
      kind: 'number' as const,
      bindable: false,
      info: 'UI design resolution width in px. The UI scales to fit the player’s screen.',
    },
    {
      label: 'Canvas height',
      componentId: UI_MARKER,
      path: 'canvasHeight',
      kind: 'number' as const,
      bindable: false,
      info: 'UI design resolution height in px. The UI scales to fit the player’s screen.',
    },
  ],
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

// YGWrap
const FLEX_WRAP_OPTIONS: EnumOption[] = [
  { value: 0, label: 'No wrap' },
  { value: 1, label: 'Wrap' },
  { value: 2, label: 'Wrap reverse' },
];

// YGOverflow
const OVERFLOW_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Visible' },
  { value: 1, label: 'Hidden' },
  { value: 2, label: 'Scroll' },
];

// Font
const FONT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Sans serif' },
  { value: 1, label: 'Serif' },
  { value: 2, label: 'Monospace' },
];

// TextWrap
const TEXT_WRAP_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Wrap' },
  { value: 1, label: 'No wrap' },
];

// BackgroundTextureMode
const TEXTURE_MODE_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Nine slices' },
  { value: 1, label: 'Center' },
  { value: 2, label: 'Stretch' },
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
  {
    label: 'Align content',
    componentId: TRANSFORM,
    path: 'alignContent',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
  },
  {
    label: 'Flex wrap',
    componentId: TRANSFORM,
    path: 'flexWrap',
    kind: 'enum' as const,
    options: FLEX_WRAP_OPTIONS,
    bindable: false,
  },
  {
    label: 'Flex grow',
    componentId: TRANSFORM,
    path: 'flexGrow',
    kind: 'number' as const,
    info: 'Share of free space this item takes along the main axis.',
  },
  {
    label: 'Flex shrink',
    componentId: TRANSFORM,
    path: 'flexShrink',
    kind: 'number' as const,
  },
  {
    label: 'Overflow',
    componentId: TRANSFORM,
    path: 'overflow',
    kind: 'enum' as const,
    options: OVERFLOW_OPTIONS,
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
    label: 'Min size',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'minWidth', leftLabel: 'W' },
      { path: 'minHeight', leftLabel: 'H' },
    ],
    bindable: false,
  },
  {
    label: 'Max size',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'maxWidth', leftLabel: 'W' },
      { path: 'maxHeight', leftLabel: 'H' },
    ],
    bindable: false,
  },
  {
    label: 'Align self',
    componentId: TRANSFORM,
    path: 'alignSelf',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
  },
  {
    label: 'Position type',
    componentId: TRANSFORM,
    path: 'positionType',
    kind: 'enum' as const,
    options: POSITION_TYPE_OPTIONS,
    bindable: false,
    info: 'Absolute positions via Top/Right/Bottom/Left; Relative flows in layout.',
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
    info: 'Ignored when Position type is Absolute.',
    disabledWhen: v => (v.positionType as number) === 1,
  },
];

// Roots resolve their size from the Canvas width/height on the marker, not from
// their UiTransform — so a root exposes only Padding from the box fields. Size /
// Min / Max / Align self / Position type / Position / Margin are intentionally
// omitted (the root always fills the screen at 100% × 100% relative).
const LAYOUT_BOX_FIELDS_ROOT: FieldConfig[] = [
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
  fields.push(...(isRoot ? LAYOUT_BOX_FIELDS_ROOT : LAYOUT_BOX_FIELDS));
  return { title: 'Layout', fields };
}

export const EFFECTS_GROUP = {
  title: 'Effects',
  fields: [
    {
      label: 'Opacity',
      componentId: TRANSFORM,
      path: 'opacity',
      kind: 'number' as const,
      info: '0 = fully transparent, 1 = fully opaque.',
    },
    {
      label: 'Z-index',
      componentId: TRANSFORM,
      path: 'zIndex',
      kind: 'number' as const,
      info: 'Stacking order; higher values render in front of siblings.',
    },
  ],
};

export const BORDER_GROUP = {
  title: 'Border',
  fields: [
    {
      label: 'Corner radius',
      componentId: TRANSFORM,
      path: 'borderTopLeftRadius',
      kind: 'length' as const,
      bindable: false,
      info: 'Rounds all four corners. Supports px or %.',
      writeAll: [
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
      ],
    },
    {
      label: 'Border width',
      componentId: TRANSFORM,
      path: 'borderTopWidth',
      kind: 'length' as const,
      bindable: false,
      info: 'Thickness of all four borders. Supports px or %.',
      writeAll: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
    },
    {
      label: 'Border color',
      componentId: TRANSFORM,
      path: 'borderTopColor',
      kind: 'color' as const,
      bindable: false,
      info: 'Color applied to all four borders.',
      writeAll: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
    },
  ],
};

const BACKGROUND_GROUP = {
  title: 'Background',
  fields: [
    { label: 'Color', componentId: BACKGROUND, path: 'color', kind: 'color' as const },
    {
      label: 'Texture mode',
      componentId: BACKGROUND,
      path: 'textureMode',
      kind: 'enum' as const,
      options: TEXTURE_MODE_OPTIONS,
      bindable: false,
    },
    {
      label: 'Texture',
      componentId: BACKGROUND,
      path: 'texture',
      kind: 'texture' as const,
      bindable: false,
      info: 'Pick an image asset from your scene.',
    },
  ],
};

const TEXT_GROUP = {
  title: 'Text',
  fields: [
    { label: 'Value', componentId: TEXT, path: 'value', kind: 'string' as const, mixable: true },
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
    {
      label: 'Font',
      componentId: TEXT,
      path: 'font',
      kind: 'enum' as const,
      options: FONT_OPTIONS,
      bindable: false,
    },
    {
      label: 'Text wrap',
      componentId: TEXT,
      path: 'textWrap',
      kind: 'enum' as const,
      options: TEXT_WRAP_OPTIONS,
      bindable: false,
    },
  ],
};

const INPUT_GROUP = {
  title: 'Input',
  fields: [
    {
      label: 'Placeholder',
      componentId: INPUT,
      path: 'placeholder',
      kind: 'string' as const,
      mixable: true,
    },
    { label: 'Value', componentId: INPUT, path: 'value', kind: 'string' as const, mixable: true },
    { label: 'Disabled', componentId: INPUT, path: 'disabled', kind: 'boolean' as const },
    { label: 'Color', componentId: INPUT, path: 'color', kind: 'color' as const },
    {
      label: 'Placeholder color',
      componentId: INPUT,
      path: 'placeholderColor',
      kind: 'color' as const,
    },
    {
      label: 'Text align',
      componentId: INPUT,
      path: 'textAlign',
      kind: 'enum' as const,
      options: TEXT_ALIGN_OPTIONS,
      bindable: false,
    },
    {
      label: 'Font',
      componentId: INPUT,
      path: 'font',
      kind: 'enum' as const,
      options: FONT_OPTIONS,
      bindable: false,
    },
    { label: 'Font size', componentId: INPUT, path: 'fontSize', kind: 'number' as const },
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
    },
    {
      label: 'Accept empty',
      componentId: DROPDOWN,
      path: 'acceptEmpty',
      kind: 'boolean' as const,
      bindable: false,
      info: 'Allows the dropdown to have no option selected.',
    },
    {
      label: 'Empty label',
      componentId: DROPDOWN,
      path: 'emptyLabel',
      kind: 'string' as const,
      info: 'Text shown when no option is selected.',
    },
    { label: 'Disabled', componentId: DROPDOWN, path: 'disabled', kind: 'boolean' as const },
    { label: 'Color', componentId: DROPDOWN, path: 'color', kind: 'color' as const },
    {
      label: 'Text align',
      componentId: DROPDOWN,
      path: 'textAlign',
      kind: 'enum' as const,
      options: TEXT_ALIGN_OPTIONS,
      bindable: false,
    },
    {
      label: 'Font',
      componentId: DROPDOWN,
      path: 'font',
      kind: 'enum' as const,
      options: FONT_OPTIONS,
      bindable: false,
    },
    { label: 'Font size', componentId: DROPDOWN, path: 'fontSize', kind: 'number' as const },
  ],
};

const MOUSE_EVENTS_GROUP = {
  title: 'Mouse events',
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
    {
      label: 'On mouse enter',
      componentId: UI_MARKER,
      path: 'onMouseEnter',
      kind: 'callback' as const,
    },
    {
      label: 'On mouse leave',
      componentId: UI_MARKER,
      path: 'onMouseLeave',
      kind: 'callback' as const,
    },
  ],
};

const INPUT_EVENTS_GROUP = {
  title: 'Input events',
  fields: [
    { label: 'On change', componentId: INPUT, path: 'onChange', kind: 'callback' as const },
    { label: 'On submit', componentId: INPUT, path: 'onSubmit', kind: 'callback' as const },
  ],
};

const DROPDOWN_EVENTS_GROUP = {
  title: 'Dropdown events',
  fields: [
    { label: 'On change', componentId: DROPDOWN, path: 'onChange', kind: 'callback' as const },
  ],
};

// Per-node-type extra groups. The Layout group is composed dynamically by
// `buildLayoutGroup` in PropertyPanel and is NOT listed here — that keeps
// the field-order and root/container variants in one place.
export const NODE_FIELD_CONFIGS: Record<UINodeType, NodeFieldConfig> = {
  UiEntity: { groups: [BACKGROUND_GROUP, MOUSE_EVENTS_GROUP] },
  Label: { groups: [BACKGROUND_GROUP, TEXT_GROUP, MOUSE_EVENTS_GROUP] },
  Button: { groups: [BACKGROUND_GROUP, TEXT_GROUP, MOUSE_EVENTS_GROUP] },
  Input: { groups: [INPUT_GROUP, INPUT_EVENTS_GROUP, MOUSE_EVENTS_GROUP] },
  Dropdown: { groups: [DROPDOWN_GROUP, DROPDOWN_EVENTS_GROUP, MOUSE_EVENTS_GROUP] },
};
