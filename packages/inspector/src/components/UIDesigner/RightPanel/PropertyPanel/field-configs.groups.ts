import { YGU_POINT } from '../../../../lib/sdk/ui-transform-constants';
import { readAnchor } from '../../shared/align-presets';
import { UI_BUTTON } from '../../code/parse-adapter';
import { alignmentIsRepresentable } from './alignment-presets';
import {
  ALIGN_OPTIONS,
  BACKGROUND,
  BINDS_VIA_OWN_CONTROL,
  BINDS_VIA_PRIMARY_ROW_ONLY,
  DISPLAY_OPTIONS,
  DROPDOWN,
  FLEX_WRAP_OPTIONS,
  FONT_OPTIONS,
  INPUT,
  JUSTIFY_CONTENT_OPTIONS,
  TEXT,
  TEXTURE_MODE_OPTIONS,
  TRANSFORM,
  UI_EVENTS,
} from './field-configs.constants';
import { wrapIsRepresentable, YGW_WRAP_REVERSE } from './flow';
import type { FieldConfig } from './field-configs.types';

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

export const STYLE_GROUP = {
  title: 'Style',
  fields: [
    {
      label: 'Opacity',
      componentId: TRANSFORM,
      path: 'opacity',
      kind: 'number' as const,
      core: true,
      half: true,
      suffix: '%',
      defaultValue: 1,
      toDisplay: (opacity: number) => round2(opacity * 100),
      fromDisplay: (opacityPct: number) => round4(opacityPct / 100),
      info: '100% is fully opaque, 0% fully transparent.',
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

export const TEXT_GROUP = {
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

export const BUTTON_GROUP = {
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

export const INPUT_GROUP = {
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

export const DROPDOWN_GROUP = {
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

export const MOUSE_EVENTS_GROUP = {
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

export const INPUT_EVENTS_GROUP = {
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

export const DROPDOWN_EVENTS_GROUP = {
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
