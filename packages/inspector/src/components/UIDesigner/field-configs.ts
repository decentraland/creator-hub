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
  | 'texture'
  // Unity-style 3×3 anchor grid → writes positionType + edge insets / auto
  // margins onto the UiTransform (path '', reads the whole component).
  | 'align-preset'
  // Positioning mode switch (in flow ⟷ absolute). Renders like `enum` but the
  // write is mode-preserving: → Absolute bakes the current on-screen offset as
  // Top/Left px; → In flow clears all position offsets (Yoga applies position*
  // to RELATIVE nodes too, so stale values would shift the node in flow).
  | 'position-mode'
  // Nested margin→padding→content box (CSS-devtools style) → writes the 8
  // margin*/padding* px fields on the UiTransform (path '').
  | 'box-model'
  // Texture sub-region (atlas/spritesheet) → writes the `uvs` 8-float array.
  | 'uv-region'
  // Nine-slice border insets → writes `textureSlices` {top,right,bottom,left}.
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
  /**
   * When this returns true (given the field's component value), the field is
   * not rendered at all (vs. `disabledWhen` which greys it). Used to show the
   * texture-region editor only in Stretch mode and slices only in nine-slices.
   */
  hiddenWhen?: (componentValue: Record<string, unknown>) => boolean;
  /**
   * When set, the raw input value is passed through this function before being
   * written. Only consulted for `kind: 'string'` fields.
   */
  sanitize?: (value: string) => string;
  /**
   * Exact variable types the VariablePicker may offer for this field,
   * overriding the kind-based coercion table. Used by TS-typed component
   * props, where render-time string coercion doesn't apply.
   */
  strictTypes?: string[];
  /** One-line help shown as a hover tooltip beside the field label. */
  info?: string;
  /**
   * Always shown in the panel — the curated baseline for its group. Optional
   * scalar-ish fields WITHOUT this flag are hidden until set (or added via the
   * group's `+ Add property` menu) and carry a `−` to unset them. Composite /
   * context-gated fields (texture, box-model, anchor, uv-region, callbacks) are
   * always shown regardless. See PropertyPanel `isTogglable`.
   */
  core?: boolean;
  /**
   * For `enum` fields whose in-world default is not the zero option: the value
   * the dropdown shows when the component leaves the prop unset. e.g. UiText
   * `textAlign` defaults to `center` (4) in the runtime (@dcl/ecs PBUiText:
   * "alignment within the bounds (default: center)"), not the proto-3 zero
   * (top-left). Reads only — leaving the prop unset still renders the default;
   * the value is written only if the user picks an option.
   */
  defaultValue?: number;
}

export interface NodeFieldConfig {
  groups: { title: string; fields: FieldConfig[] }[];
}

const TRANSFORM = 'core::UiTransform';
const BACKGROUND = 'core::UiBackground';
const TEXT = 'core::UiText';
const INPUT = 'core::UiInput';
const DROPDOWN = 'core::UiDropdown';
// Editor-internal namespace for element-level event fields (onMouseDown, …).
// Only used to key binding rows between the parse adapter and the panel —
// never written into source. Must match parse-adapter's eventFieldKey.
const UI_EVENTS = 'ui::events';

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
  { value: 0, label: 'In flow' },
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
    core: true,
    info: 'Flex lays out the node and its children; None removes it from layout entirely.',
  },
  {
    label: 'Flex direction',
    componentId: TRANSFORM,
    path: 'flexDirection',
    kind: 'enum' as const,
    options: FLEX_DIRECTION_OPTIONS,
    bindable: false,
    info: 'Main axis children flow along: row (horizontal) or column (vertical).',
  },
  {
    label: 'Justify content',
    componentId: TRANSFORM,
    path: 'justifyContent',
    kind: 'enum' as const,
    options: JUSTIFY_CONTENT_OPTIONS,
    bindable: false,
    info: 'Distributes children along the main axis, including the space between them.',
  },
  {
    label: 'Align items',
    componentId: TRANSFORM,
    path: 'alignItems',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
    info: 'Aligns children on the cross axis (perpendicular to the flex direction).',
  },
  {
    label: 'Align content',
    componentId: TRANSFORM,
    path: 'alignContent',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
    info: 'Aligns wrapped lines on the cross axis. Applies only when Flex wrap is on.',
  },
  {
    label: 'Flex wrap',
    componentId: TRANSFORM,
    path: 'flexWrap',
    kind: 'enum' as const,
    options: FLEX_WRAP_OPTIONS,
    bindable: false,
    info: 'Lets children flow onto multiple lines when they do not fit on one.',
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
    info: 'How much this item shrinks when space is tight (0 = never shrink).',
  },
  {
    label: 'Overflow',
    componentId: TRANSFORM,
    path: 'overflow',
    kind: 'enum' as const,
    options: OVERFLOW_OPTIONS,
    bindable: false,
    info: 'How content larger than the box is handled: visible, hidden, or scroll.',
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
    core: true,
    info: 'Width and height. Each supports px or % of the parent.',
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
    info: 'Lower bound on size; the node never renders smaller. Supports px or %.',
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
    info: 'Upper bound on size; the node never renders larger. Supports px or %.',
  },
  {
    label: 'Align self',
    componentId: TRANSFORM,
    path: 'alignSelf',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    bindable: false,
    info: "Overrides the parent's Align items for this node only.",
  },
  {
    label: 'Positioning',
    componentId: TRANSFORM,
    path: 'positionType',
    kind: 'position-mode' as const,
    options: POSITION_TYPE_OPTIONS,
    bindable: false,
    core: true,
    info: 'In flow: laid out by the parent (order, gaps, alignment). Absolute: pinned at Top/Left offsets. Switching keeps the node where it is on screen.',
  },
  {
    label: 'Anchor',
    componentId: TRANSFORM,
    path: '',
    kind: 'align-preset' as const,
    bindable: false,
    disabledWhen: v => ((v.positionType as number | undefined) ?? 0) !== 1,
    info: 'Pin the node to a point of its parent. Available when Positioning is Absolute.',
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
    info: 'Top / Right / Bottom / Left offsets. Applied when Positioning is Absolute.',
  },
  {
    label: 'Spacing',
    componentId: TRANSFORM,
    path: '',
    kind: 'box-model' as const,
    bindable: false,
    info: 'Margin (outer) wraps padding (inner). Margin is ignored when Position type is Absolute.',
  },
];

/**
 * Compose the Layout group for a given node type.
 * @param isContainer include the flex-layout fields (only UiEntity nodes).
 */
export function buildLayoutGroup(isContainer: boolean) {
  const fields: FieldConfig[] = [];
  if (isContainer) fields.push(...LAYOUT_FLEX_FIELDS);
  fields.push(...LAYOUT_BOX_FIELDS);
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
    {
      label: 'Color',
      componentId: BACKGROUND,
      path: 'color',
      kind: 'color' as const,
      core: true,
      info: "Fill color behind the node's content.",
    },
    {
      label: 'Texture mode',
      componentId: BACKGROUND,
      path: 'textureMode',
      kind: 'enum' as const,
      options: TEXTURE_MODE_OPTIONS,
      bindable: false,
      info: 'How the texture fills the box: nine-slice, center, or stretch.',
    },
    {
      label: 'Texture',
      componentId: BACKGROUND,
      path: 'texture',
      kind: 'texture' as const,
      bindable: false,
      info: 'Pick an image asset from your scene.',
    },
    {
      label: 'Texture region',
      componentId: BACKGROUND,
      path: '',
      kind: 'uv-region' as const,
      bindable: false,
      info: 'Use a rectangular sub-region of the texture (atlas / spritesheet). Normalized 0–1.',
      // Stretch mode only, and only when a texture is set.
      hiddenWhen: (v: Record<string, unknown>) =>
        (v.textureMode as number | undefined) !== 2 || !v.texture,
    },
    {
      label: 'Texture slices',
      componentId: BACKGROUND,
      path: 'textureSlices',
      kind: 'border-rect' as const,
      bindable: false,
      info: 'Nine-slice border sizes as a fraction (0–1) of the texture per edge.',
      hiddenWhen: (v: Record<string, unknown>) =>
        (v.textureMode as number | undefined) !== 0 || !v.texture,
    },
  ],
};

const TEXT_GROUP = {
  title: 'Text',
  fields: [
    {
      label: 'Value',
      componentId: TEXT,
      path: 'value',
      kind: 'string' as const,
      mixable: true,
      core: true,
    },
    { label: 'Color', componentId: TEXT, path: 'color', kind: 'color' as const },
    {
      label: 'Font size',
      componentId: TEXT,
      path: 'fontSize',
      kind: 'number' as const,
      core: true,
      info: 'Text size in pixels.',
    },
    {
      label: 'Text align',
      componentId: TEXT,
      path: 'textAlign',
      kind: 'enum' as const,
      options: TEXT_ALIGN_OPTIONS,
      bindable: false,
      // UiText.textAlign defaults to center (4) in-world, not the zero option.
      defaultValue: 4,
      info: 'Anchors the text within its box. Defaults to middle center.',
    },
    {
      label: 'Font',
      componentId: TEXT,
      path: 'font',
      kind: 'enum' as const,
      options: FONT_OPTIONS,
      bindable: false,
      info: 'Typeface: sans serif, serif, or monospace.',
    },
    {
      label: 'Text wrap',
      componentId: TEXT,
      path: 'textWrap',
      kind: 'enum' as const,
      options: TEXT_WRAP_OPTIONS,
      bindable: false,
      info: 'Wrap long text onto multiple lines, or keep it on one line.',
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
      core: true,
    },
    {
      label: 'Value',
      componentId: INPUT,
      path: 'value',
      kind: 'string' as const,
      mixable: true,
      core: true,
    },
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
      // UiText.textAlign defaults to center (4) in-world, not the zero option.
      defaultValue: 4,
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
    {
      label: 'Options',
      componentId: DROPDOWN,
      path: 'options',
      kind: 'string-array' as const,
      core: true,
    },
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
      // UiText.textAlign defaults to center (4) in-world, not the zero option.
      defaultValue: 4,
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
      componentId: UI_EVENTS,
      path: 'onMouseDown',
      kind: 'callback' as const,
    },
    {
      label: 'On mouse up',
      componentId: UI_EVENTS,
      path: 'onMouseUp',
      kind: 'callback' as const,
    },
    {
      label: 'On mouse enter',
      componentId: UI_EVENTS,
      path: 'onMouseEnter',
      kind: 'callback' as const,
    },
    {
      label: 'On mouse leave',
      componentId: UI_EVENTS,
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
// EVERY react-ecs element accepts the full EntityPropTypes (uiTransform,
// uiBackground, mouse events — see @dcl/react-ecs components/types.ts), so
// every type lists BACKGROUND_GROUP + MOUSE_EVENTS_GROUP alongside its own
// props (and gets Layout/Effects/Border from the panel).
export const NODE_FIELD_CONFIGS: Record<UINodeType, NodeFieldConfig> = {
  UiEntity: { groups: [BACKGROUND_GROUP, MOUSE_EVENTS_GROUP] },
  Label: { groups: [TEXT_GROUP, BACKGROUND_GROUP, MOUSE_EVENTS_GROUP] },
  Button: { groups: [TEXT_GROUP, BACKGROUND_GROUP, MOUSE_EVENTS_GROUP] },
  Input: { groups: [INPUT_GROUP, BACKGROUND_GROUP, INPUT_EVENTS_GROUP, MOUSE_EVENTS_GROUP] },
  Dropdown: {
    groups: [DROPDOWN_GROUP, BACKGROUND_GROUP, DROPDOWN_EVENTS_GROUP, MOUSE_EVENTS_GROUP],
  },
};
