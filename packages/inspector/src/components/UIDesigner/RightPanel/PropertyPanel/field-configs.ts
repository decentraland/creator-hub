import { YGU_POINT } from '../../../../lib/sdk/ui-transform-constants';
import { readAnchor } from '../../shared/align-presets';
import { UI_BUTTON } from '../../code/parse-adapter';
import { flattenedToErgonomicPath } from '../../code/transform-patch';
import type { UINodeType } from '../../shared/tree-model';
import { directionIsRepresentable, wrapIsRepresentable, YGW_WRAP_REVERSE } from './flow';
import { alignmentIsRepresentable } from './alignment-presets';


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
  /**
   * For a `length-vec` that shows fewer cells than it stores (Position: four
   * edges, two cells): which sub-fields to render for a given component value.
   * Absent → all `subFields`, always. A function rather than a fixed list because
   * Position's pair depends on where the node is pinned — see the Position config.
   */
  facadeSubFields?: (componentValue: Record<string, unknown> | null) => VecSubField[];
  /**
   * For the Size `length-vec`: render an aspect-ratio lock toggle that constrains
   * width/height to their current ratio on edit (panel edits + canvas resize).
   * Editor-only — the lock lives in redux (getAspectLockedNodes), never in source.
   */
  aspectLockable?: boolean;
  /**
   * For a `number` field whose UI unit is not the SDK prop's: the pair converting
   * between them. Transparency is the case — it reads as the INVERSE of `opacity`
   * on a 0–100 scale, so only the display boundary flips and source keeps the
   * SDK's own semantics. Must be exact inverses of each other, at the extremes as
   * well as in the middle (asserted in field-configs.spec).
   */
  toDisplay?: (sourceValue: number) => number;
  fromDisplay?: (displayValue: number) => number;
  /**
   * A fixed unit glyph inside the input, right-aligned. For a field whose unit can
   * never vary, which is why it is a label and not the `length` kinds' selector.
   */
  suffix?: string;
  /**
   * Render this row at half width so it pairs with the adjacent half-width row
   * (the design draws Transparency·Corner Radius and Border Colour·Weight as two
   * columns). Purely presentational — the panel's row grid does the packing, so
   * a half row whose neighbour is hidden simply keeps its own line.
   */
  half?: boolean;
  /**
   * Whether this field can be bound to a declared UI variable. Defaults to true.
   * Composite kinds (`length`, `length-vec`) and enum/index
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
   * Describes how the node sits in its PARENT, so it has no meaning on a UI root —
   * a root's parent is the screen itself. Node identity is not available to
   * `hiddenWhen` (which only sees the component value), so the panel checks this
   * flag separately, where it knows which node is selected.
   *
   * The panel keeps these fields on a root that is ALREADY absolute: canvas-dragging
   * a root switches it, and they are then the only controls over the offsets sitting
   * in source. See PropertyPanel.
   */
  hideOnRoot?: boolean;
  /**
   * When this returns true (given the field's component value), the field's ROW is
   * not rendered (vs. `disabledWhen` which greys it). Two uses:
   *  - context-gating — the texture-region editor only in Stretch mode, slices
   *    only in nine-slices;
   *  - suppressing a single-prop row while a composite control already represents
   *    its value, so no value is ever driven by two live controls.
   * It does NOT remove the field from `+ Add property`; an unset optional prop
   * stays addable so a value the composite has no cell for still has a way in.
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
  /** For `box-model`: which edge box the row renders — `padding` or `margin`. */
  box?: 'padding' | 'margin';
  /**
   * Always shown in the panel — the curated baseline for its group. Optional
   * scalar-ish fields WITHOUT this flag are hidden until set (or added via the
   * group's `+ Add property` menu) and carry a `−` to unset them. Composite /
   * context-gated fields (texture, box-model, anchor, uv-region, callbacks) are
   * always shown regardless. See PropertyPanel `isTogglable`.
   */
  core?: boolean;
  /**
   * Draw an unset optional prop as a label plus a `+` on its own line, instead of
   * hiding it inside the group's `+ Add property` menu. For the composites the
   * design keeps permanently in view (Min Size, Max Size, Border): the menu makes
   * them look absent, and they are common enough to deserve the standing row.
   * Adding and removing still go through `buildAddPatch` / `buildRemovePatch`.
   */
  inlineAdd?: boolean;
  /**
   * Extra props seeded alongside this one when it is added, for a field whose
   * kind-based seed alone would leave the new rows inert — Border's colour
   * without a width renders as nothing at all.
   */
  addAlso?: Record<string, unknown>;
  /**
   * For `enum` and `number` fields whose in-world default is not the zero value:
   * the value the control shows when the component leaves the prop unset. e.g. UiText
   * `textAlign` defaults to `center` (4) in the runtime (@dcl/ecs PBUiText:
   * "alignment within the bounds (default: center)"), not the proto-3 zero
   * (top-left). Leaving the prop unset still renders the in-world default; the
   * value reaches source only when the user picks an option — or when they add the
   * field from `+ Add property`, which seeds this (PropertyPanel `buildAddPatch`).
   */
  defaultValue?: number;
}

export interface NodeFieldConfig {
  groups: { title: string; fields: FieldConfig[] }[];
}

/**
 * `bindable` values that say WHY a field offers no bind affordance, so the reason
 * travels with the flag instead of a comment beside it.
 *
 * - OWN_CONTROL: the control itself owns a mode-aware affordance (FillField picks
 *   `color` / `texture.src` / `avatarTexture.userId` from the current mode).
 * - PRIMARY_ROW_ONLY: two panel rows render one prop, so only the primary row
 *   offers the bind — a second affordance would show two pills for one binding.
 */
const BINDS_VIA_OWN_CONTROL = false;
const BINDS_VIA_PRIMARY_ROW_ONLY = false;

export const TRANSFORM = 'core::UiTransform';
const BACKGROUND = 'core::UiBackground';

/**
 * The uiBackground props that can hold a binding: keys of their own, plus the
 * texture variants' single meaningful member, addressed by a dotted path.
 */
const BACKGROUND_BINDABLE_PATHS = new Set([
  'color',
  'textureMode',
  'texture.src',
  'avatarTexture.userId',
]);

/**
 * Which code-mode variable types a field kind can bind to. A string field takes
 * any (it coerces to text at render); numeric fields take numbers; booleans take
 * booleans. An ENUM-shaped field takes a string: react-ecs spells those props as
 * ergonomic strings (`positionType: 'absolute'`, `textAlign: 'top-left'`), so a
 * bound variable holds that string rather than the panel's PB number.
 *
 * A kind ABSENT here has no variable type that can hold its value, and is not
 * bindable at all (see isBindableProp) — offering one would seed a `string` and
 * break the scene's own typecheck. `Color4` and `string[]` are object-shaped state
 * variables (see state-convention's TYPE_ANNOTATION).
 */
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

/**
 * The prop path a field's binding is written to and read back from.
 *
 * A `writeAll` field drives a whole ergonomic group uniformly (Corner Radius sets
 * all four corners), and react-ecs takes a scalar shorthand for those
 * (`borderRadius: 8`), so the binding targets the GROUP rather than the one member
 * `path` happens to name. Everything else binds its own path.
 */
export function bindPathFor(field: { path: string; writeAll?: string[] }): string {
  if (!field.writeAll) return field.path;
  return flattenedToErgonomicPath(field.path)?.group ?? field.path;
}

/**
 * Whether a prop can carry a binding that round-trips to source and back.
 *
 * Two independent questions. WHERE it lives: a uiTransform prop is spliced by its
 * ergonomic location — a key of its own (`zIndex`) or a member of a per-edge group
 * (`padding: { top }`) — so any path the shape can place works, while `parent` is
 * structural and never reaches source; uiBackground allows its own keys plus a
 * texture variant's member; every other component's props are top-level JSX
 * attributes. And WHAT could hold it: a kind with no compatible variable type
 * cannot be bound at all.
 */
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
const TEXT = 'core::UiText';
const INPUT = 'core::UiInput';
const DROPDOWN = 'core::UiDropdown';
const UI_EVENTS = 'ui::events';

const FLEX_DIRECTION_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Row' },
  { value: 1, label: 'Column' },
  { value: 2, label: 'Column reverse' },
  { value: 3, label: 'Row reverse' },
];

const JUSTIFY_CONTENT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex start' },
  { value: 1, label: 'Center' },
  { value: 2, label: 'Flex end' },
  { value: 3, label: 'Space between' },
  { value: 4, label: 'Space around' },
  { value: 5, label: 'Space evenly' },
];

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

const DISPLAY_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Flex' },
  { value: 1, label: 'None' },
];

const FLEX_WRAP_OPTIONS: EnumOption[] = [
  { value: 0, label: 'No wrap' },
  { value: 1, label: 'Wrap' },
  { value: 2, label: 'Wrap reverse' },
];

const FONT_OPTIONS: EnumOption[] = [
  { value: 0, label: 'Sans serif' },
  { value: 1, label: 'Serif' },
  { value: 2, label: 'Monospace' },
];

const TEXTURE_MODE_OPTIONS: EnumOption[] = [
  { value: 1, label: 'Crop' },
  { value: 0, label: 'Sliced' },
  { value: 2, label: 'Stretched' },
];

export const POSITION_MODE_FIELD: FieldConfig = {
  label: 'Ignore Layout Flow',
  componentId: TRANSFORM,
  path: 'positionType',
  kind: 'position-mode',
  core: true,
  hideOnRoot: true,
  info: 'Off: laid out by the parent (order, gaps, alignment). On: pinned at Top/Left offsets. Turning it on anchors the node to the parent’s top-left — set Anchor and Position to place it.',
};

export const POSITION_GROUP = {
  title: 'Position',
  fields: [
    {
      label: 'Constraints',
      componentId: TRANSFORM,
      path: '',
      kind: 'align-preset' as const,
      bindable: false,
      hideOnRoot: true,
      disabledWhen: (v: Record<string, unknown>) =>
        ((v.positionType as number | undefined) ?? 0) !== 1,
      info: 'Pin the node to a point of its parent. Available when the node ignores layout flow.',
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
      facadeSubFields: (v: Record<string, unknown> | null) => {
        const { h, v: vertical } = readAnchor(v);
        return [
          { path: h === 'right' ? 'positionRight' : 'positionLeft', leftLabel: 'X' },
          { path: vertical === 'bottom' ? 'positionBottom' : 'positionTop', leftLabel: 'Y' },
        ];
      },
      bindable: false,
      core: true,
      hideOnRoot: true,
      disabledWhen: (v: Record<string, unknown>) =>
        ((v.positionType as number | undefined) ?? 0) !== 1,
      info: 'X / Y offset from the parent, on the edges the Anchor pins. Applied when the node ignores layout flow.',
    },
    {
      label: 'Z-Index',
      componentId: TRANSFORM,
      path: 'zIndex',
      kind: 'number' as const,
      core: true,
      info: 'Stacking order; higher values render in front of siblings.',
    },
  ],
};

const LAYOUT_FIELDS: (FieldConfig & { container?: true })[] = [
  {
    label: 'Flow',
    componentId: TRANSFORM,
    path: '',
    kind: 'flow' as const,
    bindable: false,
    container: true,
    core: true,
    info: 'How this node lays its children out — or Absolute, which lifts the node out of its own parent’s flow. Wrap lets children spill onto more than one line.',
  },
  {
    label: 'Size',
    componentId: TRANSFORM,
    path: '',
    kind: 'resize' as const,
    subFields: [
      { path: 'width', leftLabel: 'W' },
      { path: 'height', leftLabel: 'H' },
    ],
    bindable: false,
    core: true,
    aspectLockable: true,
    info: 'Width and height. Each axis picks its own mode: a fixed px value, a % of the parent, Hug (sized from the content) or Fill (takes the free space). Lock keeps their ratio on resize.',
  },
  {
    label: 'Min Size',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'minWidth', leftLabel: 'W' },
      { path: 'minHeight', leftLabel: 'H' },
    ],
    bindable: false,
    inlineAdd: true,
    info: 'Lower bound on size; the node never renders smaller. Supports px or %.',
  },
  {
    label: 'Max Size',
    componentId: TRANSFORM,
    path: '',
    kind: 'length-vec' as const,
    subFields: [
      { path: 'maxWidth', leftLabel: 'W' },
      { path: 'maxHeight', leftLabel: 'H' },
    ],
    bindable: false,
    inlineAdd: true,
    info: 'Upper bound on size; the node never renders larger. Supports px or %.',
  },
  {
    label: 'Alignment',
    componentId: TRANSFORM,
    path: '',
    kind: 'alignment' as const,
    bindable: false,
    container: true,
    core: true,
    info: 'Where the children sit inside this node. Writes Justify content and Align items together, resolved against the current Flow direction.',
  },
  {
    label: 'Padding',
    componentId: TRANSFORM,
    path: '',
    kind: 'box-model' as const,
    box: 'padding',
    bindable: false,
    info: 'Space inside the box, per edge, in px.',
  },
  {
    label: 'Margin',
    componentId: TRANSFORM,
    path: '',
    kind: 'box-model' as const,
    box: 'margin',
    bindable: false,
    info: 'Space outside the box, per edge, in px. Ignored while the node ignores layout flow. Not "Spacing": react-ecs has no flex gap (no gap/rowGap/columnGap in UiTransformProps).',
  },
  {
    label: 'Scroll Overflow',
    componentId: TRANSFORM,
    path: 'overflow',
    kind: 'overflow-scroll' as const,
    container: true,
    core: true,
    info: 'Lets the player scroll content taller or wider than this box. Scrolling requires clipping, so Clip Content follows it.',
  },
  {
    label: 'Clip Content',
    componentId: TRANSFORM,
    path: 'overflow',
    kind: 'overflow-clip' as const,
    bindable: BINDS_VIA_PRIMARY_ROW_ONLY,
    container: true,
    core: true,
    info: 'Hides anything that overflows this box instead of letting it spill out. Forced on while Scroll Overflow is on.',
  },
  {
    label: 'Flex Direction',
    componentId: TRANSFORM,
    path: 'flexDirection',
    kind: 'enum' as const,
    options: FLEX_DIRECTION_OPTIONS,
    container: true,
    hiddenWhen: directionIsRepresentable,
    info: 'Main axis children flow along. Shown while the node ignores layout flow, where the Flow control cannot display it.',
  },
  {
    label: 'Flex Wrap',
    componentId: TRANSFORM,
    path: 'flexWrap',
    kind: 'enum' as const,
    options: FLEX_WRAP_OPTIONS,
    container: true,
    hiddenWhen: wrapIsRepresentable,
    defaultValue: YGW_WRAP_REVERSE,
    info: 'Lets children flow onto multiple lines. Adding it selects wrap-reverse, the one value the Flow wrap toggle cannot express.',
  },
  {
    label: 'Justify Content',
    componentId: TRANSFORM,
    path: 'justifyContent',
    kind: 'enum' as const,
    options: JUSTIFY_CONTENT_OPTIONS,
    container: true,
    hiddenWhen: alignmentIsRepresentable,
    info: 'Distributes children along the main axis. Shown when the spacing is one the Alignment picker has no cell for.',
  },
  {
    label: 'Align Items',
    componentId: TRANSFORM,
    path: 'alignItems',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    container: true,
    hiddenWhen: alignmentIsRepresentable,
    info: 'Aligns children on the cross axis. Shown when the alignment is one the Alignment picker has no cell for.',
  },
  {
    label: 'Align Content',
    componentId: TRANSFORM,
    path: 'alignContent',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    container: true,
    info: 'Aligns wrapped lines on the cross axis. Applies only when Flex wrap is on.',
  },
  {
    label: 'Align Self',
    componentId: TRANSFORM,
    path: 'alignSelf',
    kind: 'enum' as const,
    options: ALIGN_OPTIONS,
    info: "Overrides the parent's Align items for this node only. Shown when it is set to something the Resize control's cross-axis Fill cannot express.",
  },
  {
    label: 'Flex Grow',
    componentId: TRANSFORM,
    path: 'flexGrow',
    kind: 'number' as const,
    info: 'Share of free space this item takes along the main axis. Shown when it is a share other than the plain Fill the Resize control writes.',
  },
  {
    label: 'Flex Shrink',
    componentId: TRANSFORM,
    path: 'flexShrink',
    kind: 'number' as const,
    info: 'How much this item shrinks when space is tight (0 = never shrink).',
  },
  {
    label: 'Display',
    componentId: TRANSFORM,
    path: 'display',
    kind: 'enum' as const,
    options: DISPLAY_OPTIONS,
    core: true,
    hiddenWhen: (v: Record<string, unknown>) => !('display' in v),
    info: 'Flex lays out the node and its children; None removes it from layout entirely. The Visibility is Active checkbox toggles this.',
  },
];

/**
 * Compose the Layout group for a given node type.
 * @param isContainer keep the container fields (only UiEntity nodes have children).
 */
export function buildLayoutGroup(isContainer: boolean) {
  return {
    title: 'Layout',
    fields: isContainer ? LAYOUT_FIELDS : LAYOUT_FIELDS.filter(f => !f.container),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const BORDER_COLOUR_PATHS = [
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
];

const BORDER_WIDTH_PATHS = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
];

const VISIBLE_BORDER_WIDTH: Record<string, unknown> = Object.fromEntries(
  BORDER_WIDTH_PATHS.flatMap(path => [
    [path, 1],
    [`${path}Unit`, YGU_POINT],
  ]),
);

const STYLE_GROUP = {
  title: 'Style',
  fields: [
    {
      label: 'Transparency',
      componentId: TRANSFORM,
      path: 'opacity',
      kind: 'number' as const,
      core: true,
      half: true,
      suffix: '%',
      defaultValue: 1,
      toDisplay: (opacity: number) => round2(100 - opacity * 100),
      fromDisplay: (transparency: number) => round4((100 - transparency) / 100),
      info: '100% is fully transparent, 0% fully opaque. Stored as the SDK’s `opacity`, which runs the other way.',
    },
    {
      label: 'Corner Radius',
      componentId: TRANSFORM,
      path: 'borderTopLeftRadius',
      kind: 'length' as const,
      core: true,
      half: true,
      info: 'Rounds all four corners. Supports px or %.',
      writeAll: [
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
      ],
    },
    {
      label: 'Fill',
      componentId: BACKGROUND,
      path: 'color',
      kind: 'fill' as const,
      bindable: BINDS_VIA_OWN_CONTROL,
      core: true,
      info: 'What fills the node: a solid colour, an image from your scene, or a player’s avatar. Setting an image is what turns a Container into an Image.',
    },
    {
      label: 'Scale Type',
      componentId: BACKGROUND,
      path: 'textureMode',
      kind: 'enum' as const,
      core: true,
      options: TEXTURE_MODE_OPTIONS,
      hiddenWhen: (v: Record<string, unknown>) => !v.texture,
      info: 'How the texture fills the box: cropped to the middle, sliced, or stretched.',
      defaultValue: 1,
    },
    {
      label: 'Texture Region',
      componentId: BACKGROUND,
      path: '',
      kind: 'uv-region' as const,
      bindable: false,
      info: 'Use a rectangular sub-region of the texture (atlas / spritesheet). Normalized 0–1.',
      hiddenWhen: (v: Record<string, unknown>) =>
        (v.textureMode as number | undefined) !== 2 || !v.texture,
    },
    {
      label: 'Texture Slices',
      componentId: BACKGROUND,
      path: 'textureSlices',
      kind: 'border-rect' as const,
      bindable: false,
      info: 'Nine-slice border sizes as a fraction (0–1) of the texture per edge.',
      hiddenWhen: (v: Record<string, unknown>) =>
        (v.textureMode as number | undefined) !== 0 || !v.texture,
    },
    {
      label: 'Border',
      componentId: TRANSFORM,
      path: 'borderTopColor',
      kind: 'color' as const,
      inlineAdd: true,
      addAlso: VISIBLE_BORDER_WIDTH,
      info: 'Colour applied to all four borders. Adding it also sets a 1px weight, without which the border renders as nothing at all.',
      writeAll: BORDER_COLOUR_PATHS,
    },
    {
      label: 'Weight',
      componentId: TRANSFORM,
      path: 'borderTopWidth',
      kind: 'length' as const,
      core: true,
      hiddenWhen: (v: Record<string, unknown>) => !(BORDER_COLOUR_PATHS[0] in v),
      info: 'Thickness of all four borders. Supports px or %.',
      writeAll: BORDER_WIDTH_PATHS,
    },
  ],
};

const TEXT_GROUP = {
  title: 'Text',
  fields: [
    {
      label: 'Text Input',
      componentId: TEXT,
      path: 'value',
      kind: 'string' as const,
      mixable: true,
      core: true,
      info: 'The text to show. Mix literal text with variables to build it at runtime.',
    },
    {
      label: 'Typography',
      componentId: TEXT,
      path: 'font',
      kind: 'enum' as const,
      half: true,
      core: true,
      options: FONT_OPTIONS,
      info: 'Typeface: sans serif, serif, or monospace.',
    },
    {
      label: 'Size',
      componentId: TEXT,
      path: 'fontSize',
      kind: 'number' as const,
      half: true,
      core: true,
      info: 'Text size in pixels.',
    },
    {
      label: 'Colour',
      componentId: TEXT,
      path: 'color',
      kind: 'color' as const,
      core: true,
      info: 'Color of the text itself, independent of the background behind it.',
    },
    {
      label: 'Alignment',
      componentId: TEXT,
      path: 'textAlign',
      kind: 'text-align' as const,
      info: 'Anchors the text within its box. Defaults to middle center.',
    },
    {
      label: 'Wrap',
      componentId: TEXT,
      path: 'textWrap',
      kind: 'text-wrap' as const,
      info: 'Wrap long text onto multiple lines instead of keeping it on a single line.',
    },
  ],
};

const BUTTON_GROUP = {
  title: 'Button',
  fields: [
    {
      label: 'Disabled',
      componentId: UI_BUTTON,
      path: 'disabled',
      kind: 'boolean' as const,
      core: true,
      info: 'Fades the button out and stops it responding to Mouse Down and Mouse Up.',
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
      info: 'Hint text shown while the field is empty.',
    },
    {
      label: 'Text Input',
      componentId: INPUT,
      path: 'value',
      kind: 'string' as const,
      mixable: true,
      core: true,
      info: 'The field’s starting text. Bind it to a variable to control the field from your scene.',
    },
    {
      label: 'Typography',
      componentId: INPUT,
      path: 'font',
      kind: 'enum' as const,
      half: true,
      core: true,
      options: FONT_OPTIONS,
      info: 'Typeface: sans serif, serif, or monospace.',
    },
    {
      label: 'Size',
      componentId: INPUT,
      path: 'fontSize',
      kind: 'number' as const,
      half: true,
      core: true,
      info: 'Text size in pixels.',
    },
    {
      label: 'Colour',
      componentId: INPUT,
      path: 'color',
      kind: 'color' as const,
      core: true,
      info: 'Color of the text the player types.',
    },
    {
      label: 'Placeholder Colour',
      componentId: INPUT,
      path: 'placeholderColor',
      kind: 'color' as const,
      info: 'Color of the hint text shown while the field is empty.',
    },
    {
      label: 'Alignment',
      componentId: INPUT,
      path: 'textAlign',
      kind: 'text-align' as const,
      info: 'Anchors the text within the field. Defaults to middle center.',
    },
    {
      label: 'Disabled',
      componentId: INPUT,
      path: 'disabled',
      kind: 'boolean' as const,
      core: true,
      info: 'Greys the field out and stops it accepting input.',
    },
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
      info: 'The selectable entries, one per line.',
    },
    {
      label: 'Selected Index',
      componentId: DROPDOWN,
      path: 'selectedIndex',
      kind: 'index' as const,
      core: true,
      info: 'Which option starts selected, counting from 0.',
    },
    {
      label: 'Accept Empty',
      componentId: DROPDOWN,
      path: 'acceptEmpty',
      kind: 'boolean' as const,
      core: true,
      info: 'Allows the dropdown to have no option selected.',
    },
    {
      label: 'Empty Label',
      componentId: DROPDOWN,
      path: 'emptyLabel',
      kind: 'string' as const,
      core: true,
      hiddenWhen: (v: Record<string, unknown>) => !v.acceptEmpty,
      info: 'Text shown when no option is selected. Available while Accept Empty is on.',
    },
    {
      label: 'Typography',
      componentId: DROPDOWN,
      path: 'font',
      kind: 'enum' as const,
      half: true,
      core: true,
      options: FONT_OPTIONS,
      info: 'Typeface: sans serif, serif, or monospace.',
    },
    {
      label: 'Size',
      componentId: DROPDOWN,
      path: 'fontSize',
      kind: 'number' as const,
      half: true,
      core: true,
      info: 'Text size in pixels.',
    },
    {
      label: 'Colour',
      componentId: DROPDOWN,
      path: 'color',
      kind: 'color' as const,
      core: true,
      info: 'Color of the selected option’s text.',
    },
    {
      label: 'Alignment',
      componentId: DROPDOWN,
      path: 'textAlign',
      kind: 'text-align' as const,
      info: 'Anchors the selected option’s text within the box. Defaults to middle center.',
    },
    {
      label: 'Disabled',
      componentId: DROPDOWN,
      path: 'disabled',
      kind: 'boolean' as const,
      core: true,
      info: 'Greys the dropdown out and stops it opening.',
    },
  ],
};

const MOUSE_EVENTS_GROUP = {
  title: 'Mouse Events',
  fields: [
    {
      label: 'Mouse Down',
      componentId: UI_EVENTS,
      path: 'onMouseDown',
      kind: 'callback' as const,
      info: 'Runs the moment the pointer is pressed on this node.',
    },
    {
      label: 'Mouse Up',
      componentId: UI_EVENTS,
      path: 'onMouseUp',
      kind: 'callback' as const,
      info: 'Runs when the pointer is released over this node — the usual "clicked" handler.',
    },
    {
      label: 'Mouse Enter',
      componentId: UI_EVENTS,
      path: 'onMouseEnter',
      kind: 'callback' as const,
      info: 'Runs when the pointer moves onto this node. For hover styling, use the Hover state instead.',
    },
    {
      label: 'Mouse Leave',
      componentId: UI_EVENTS,
      path: 'onMouseLeave',
      kind: 'callback' as const,
      info: 'Runs when the pointer moves off this node.',
    },
  ],
};

const INPUT_EVENTS_GROUP = {
  title: 'Input Events',
  fields: [
    {
      label: 'Change',
      componentId: INPUT,
      path: 'onChange',
      kind: 'callback' as const,
      info: 'Runs on every keystroke, with the field’s current text.',
    },
    {
      label: 'Submit',
      componentId: INPUT,
      path: 'onSubmit',
      kind: 'callback' as const,
      info: 'Runs when the player confirms the field (Enter), with its final text.',
    },
  ],
};

const DROPDOWN_EVENTS_GROUP = {
  title: 'Dropdown Events',
  fields: [
    {
      label: 'Change',
      componentId: DROPDOWN,
      path: 'onChange',
      kind: 'callback' as const,
      info: 'Runs when the player picks an option, with its index.',
    },
  ],
};

export const NODE_FIELD_CONFIGS: Record<UINodeType, NodeFieldConfig> = {
  UiEntity: { groups: [STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Label: { groups: [TEXT_GROUP, STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Button: { groups: [BUTTON_GROUP, TEXT_GROUP, STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Input: { groups: [INPUT_GROUP, STYLE_GROUP, INPUT_EVENTS_GROUP, MOUSE_EVENTS_GROUP] },
  Dropdown: {
    groups: [DROPDOWN_GROUP, STYLE_GROUP, DROPDOWN_EVENTS_GROUP, MOUSE_EVENTS_GROUP],
  },
};

export const isEventGroup = (title: string) => /event/i.test(title);

/**
 * The panel's complete group list for a node type, in render order:
 *   Position → Layout → [type content groups] → [type event groups]
 * i.e. where the node sits, then how it is laid out, then its own content and
 * appearance, with events last.
 */
export function buildGroups(type: UINodeType): { title: string; fields: FieldConfig[] }[] {
  const { groups } = NODE_FIELD_CONFIGS[type];
  return [
    POSITION_GROUP,
    buildLayoutGroup(type === 'UiEntity'),
    ...groups.filter(g => !isEventGroup(g.title)),
    ...groups.filter(g => isEventGroup(g.title)),
  ];
}
