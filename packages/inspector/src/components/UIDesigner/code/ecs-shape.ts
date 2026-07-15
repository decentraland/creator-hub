import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
} from '../../../lib/sdk/ui-transform-constants';

// Convert a react-ecs ergonomic `uiTransform` prop value into the flattened
// PBUiTransform shape the rest of the editor (Canvas nodeStyle, PropertyPanel)
// consumes. react-ecs authors write friendly values — bare numbers, '50%',
// 'auto', `position: { top }`, `positionType: 'absolute'` — which the react-ecs
// reconciler normalizes to PB (value + YGUnit + numeric enums) when writing to
// the ECS. Code-mode does that same normalization here so a parsed .tsx renders
// identically to the ECS-backed path.

type Len = number | string;

// A length → { value, unit } pair. Bare number / 'Npx' → POINT; 'N%' → PERCENT;
// 'auto' → AUTO. Unrecognized → empty (field left unset).
function toLenUnit(v: Len | undefined): { value?: number; unit?: number } {
  if (typeof v === 'number') return { value: v, unit: YGU_POINT };
  if (typeof v === 'string') {
    if (v === 'auto') return { value: 0, unit: YGU_AUTO };
    if (v.endsWith('%')) return { value: parseFloat(v), unit: YGU_PERCENT };
    const n = parseFloat(v);
    if (Number.isFinite(n)) return { value: n, unit: YGU_POINT };
  }
  return {};
}

const EDGES = ['Top', 'Right', 'Bottom', 'Left'] as const;

// Expand an edge object (`{ top, right, bottom, left }`) into flattened
// `<prefix><Edge>` + `<prefix><Edge>Unit` fields.
function writeEdges(pb: Record<string, number>, prefix: string, obj: unknown): void {
  if (!obj || typeof obj !== 'object') return;
  const rec = obj as Record<string, Len | undefined>;
  for (const edge of EDGES) {
    const { value, unit } = toLenUnit(rec[edge.toLowerCase()]);
    if (value !== undefined && unit !== undefined) {
      pb[`${prefix}${edge}`] = value;
      pb[`${prefix}${edge}Unit`] = unit;
    }
  }
}

const DIMENSIONS = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'flexBasis',
];

// react-ecs flex/layout ENUM props: ergonomic string ⇄ PBUiTransform numeric
// enum. The string spellings are exactly the keys react-ecs's own parser accepts
// (@dcl/react-ecs components/uiTransform/utils.js parse* maps) — emitting any
// other spelling (e.g. 'no-wrap' instead of 'nowrap', 'start' instead of
// 'flex-start') makes the runtime's parser return undefined and silently fall
// back to its default. The numeric values are the PBUiTransform enums (@dcl/ecs
// ui_transform.gen: YGDisplay / YGFlexDirection / YGJustify / YGAlign / YGWrap /
// YGOverflow). alignItems / alignSelf / alignContent all share the YGAlign map.
// Without this table the whole enum-prop group (Display, Flex direction, Justify,
// Align, Flex wrap, Overflow) round-trips as a no-op: parse never populates the
// PB field (so the panel dropdown always shows its default) and emit never writes
// it (so a panel change never reaches the .tsx).
const ALIGN_ENUM: Record<number, string> = {
  0: 'auto',
  1: 'flex-start',
  2: 'center',
  3: 'flex-end',
  4: 'stretch',
  5: 'baseline',
  6: 'space-between',
  7: 'space-around',
};

const ENUM_TO_STRING: Record<string, Record<number, string>> = {
  display: { 0: 'flex', 1: 'none' },
  flexDirection: { 0: 'row', 1: 'column', 2: 'column-reverse', 3: 'row-reverse' },
  justifyContent: {
    0: 'flex-start',
    1: 'center',
    2: 'flex-end',
    3: 'space-between',
    4: 'space-around',
    5: 'space-evenly',
  },
  alignItems: ALIGN_ENUM,
  alignSelf: ALIGN_ENUM,
  alignContent: ALIGN_ENUM,
  flexWrap: { 0: 'nowrap', 1: 'wrap', 2: 'wrap-reverse' },
  overflow: { 0: 'visible', 1: 'hidden', 2: 'scroll' },
};

// Inverse (ergonomic string → enum number) per prop, derived once.
const STRING_TO_ENUM: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(ENUM_TO_STRING).map(([prop, m]) => [
    prop,
    Object.fromEntries(Object.entries(m).map(([num, str]) => [str, Number(num)])),
  ]),
);

export function ergonomicToPBTransform(ergo: Record<string, unknown>): Record<string, number> {
  const pb: Record<string, number> = {};

  for (const dim of DIMENSIONS) {
    const { value, unit } = toLenUnit(ergo[dim] as Len | undefined);
    if (value !== undefined && unit !== undefined) {
      pb[dim] = value;
      pb[`${dim}Unit`] = unit;
    }
  }

  if (ergo.positionType === 'absolute') pb.positionType = YGPT_ABSOLUTE;
  else if (ergo.positionType === 'relative') pb.positionType = YGPT_RELATIVE;

  writeEdges(pb, 'position', ergo.position);
  writeEdges(pb, 'margin', ergo.margin);
  writeEdges(pb, 'padding', ergo.padding);

  if (typeof ergo.flexGrow === 'number') pb.flexGrow = ergo.flexGrow;
  if (typeof ergo.flexShrink === 'number') pb.flexShrink = ergo.flexShrink;

  // Enum props (string → numeric enum). Unknown strings are dropped.
  for (const prop of Object.keys(ENUM_TO_STRING)) {
    const v = ergo[prop];
    if (typeof v === 'string') {
      const num = STRING_TO_ENUM[prop][v];
      if (num !== undefined) pb[prop] = num;
    }
  }

  return pb;
}

// Inverse of ergonomicToPBTransform: a flattened PBUiTransform (what the
// PropertyPanel edits) → the ergonomic react-ecs prop object we splice back into
// source. Units become '%' / 'auto' / bare number; `positionType` becomes
// 'absolute' (relative is the default, so it's omitted); edge groups
// (position/margin/padding) fold back into `{ top, right, bottom, left }`.
// Fields with an undefined/unrecognized unit are dropped, so switching back to
// in-flow (which zeroes position with undefined units) cleanly removes them.
function pbLen(value: unknown, unit: unknown): Len | undefined {
  if (typeof value !== 'number') return undefined;
  if (unit === YGU_PERCENT) return `${value}%`;
  if (unit === YGU_AUTO) return 'auto';
  if (unit === YGU_POINT) return value;
  return undefined;
}

export function pbToErgonomicTransform(pb: Record<string, unknown>): Record<string, unknown> {
  const ergo: Record<string, unknown> = {};

  for (const dim of DIMENSIONS) {
    const l = pbLen(pb[dim], pb[`${dim}Unit`]);
    if (l !== undefined) ergo[dim] = l;
  }

  if (pb.positionType === YGPT_ABSOLUTE) ergo.positionType = 'absolute';

  for (const prefix of ['position', 'margin', 'padding'] as const) {
    const edges: Record<string, Len> = {};
    for (const edge of EDGES) {
      const l = pbLen(pb[`${prefix}${edge}`], pb[`${prefix}${edge}Unit`]);
      if (l !== undefined) edges[edge.toLowerCase()] = l;
    }
    if (Object.keys(edges).length > 0) ergo[prefix] = edges;
  }

  if (typeof pb.flexGrow === 'number') ergo.flexGrow = pb.flexGrow;
  if (typeof pb.flexShrink === 'number') ergo.flexShrink = pb.flexShrink;

  // Enum props (numeric enum → string). Only emitted when present in the PB, so
  // a node that never declared the prop stays undeclared (no spurious default is
  // injected); an out-of-range value is dropped.
  for (const prop of Object.keys(ENUM_TO_STRING)) {
    const v = pb[prop];
    if (typeof v === 'number') {
      const str = ENUM_TO_STRING[prop][v];
      if (str !== undefined) ergo[prop] = str;
    }
  }

  return ergo;
}

// ---------------------------------------------------------------------------
// Label text props. react-ecs's <Label> takes `textAlign` / `font` as ENUM
// STRINGS ('middle-center', 'serif' — @dcl/react-ecs Label utils parseTextAlign
// / parseFont), while the editor (field-configs, PropertyPanel, Canvas) speaks
// the PBUiText numeric enums (TextAlignMode 0-8, Font 0-2). Same translation the
// uiTransform enums need: parse normalizes to numbers, emit converts back to the
// strings the Label parser accepts. `value` / `fontSize` / `color` are the same
// shape on both sides and pass through unchanged.
// ---------------------------------------------------------------------------
const TEXT_ALIGN_ENUM: Record<number, string> = {
  0: 'top-left',
  1: 'top-center',
  2: 'top-right',
  3: 'middle-left',
  4: 'middle-center',
  5: 'middle-right',
  6: 'bottom-left',
  7: 'bottom-center',
  8: 'bottom-right',
};

const FONT_ENUM: Record<number, string> = { 0: 'sans-serif', 1: 'serif', 2: 'monospace' };

const TEXT_ALIGN_STR: Record<string, number> = Object.fromEntries(
  Object.entries(TEXT_ALIGN_ENUM).map(([n, s]) => [s, Number(n)]),
);
const FONT_STR: Record<string, number> = Object.fromEntries(
  Object.entries(FONT_ENUM).map(([n, s]) => [s, Number(n)]),
);

// react-ecs uiText prop object → flattened PBUiText (textAlign/font string →
// numeric enum). Unknown enum strings are dropped.
export function ergonomicToPBText(ergo: Record<string, unknown>): Record<string, unknown> {
  const pb: Record<string, unknown> = { ...ergo };
  if (typeof ergo.textAlign === 'string') {
    const n = TEXT_ALIGN_STR[ergo.textAlign];
    if (n !== undefined) pb.textAlign = n;
    else delete pb.textAlign;
  }
  if (typeof ergo.font === 'string') {
    const n = FONT_STR[ergo.font];
    if (n !== undefined) pb.font = n;
    else delete pb.font;
  }
  return pb;
}

// Inverse: PBUiText → react-ecs uiText props (textAlign/font numeric enum →
// string). An out-of-range enum is dropped rather than emitted as a bare number
// (which the Label parser would reject).
export function pbToErgonomicText(pb: Record<string, unknown>): Record<string, unknown> {
  const ergo: Record<string, unknown> = { ...pb };
  if (typeof pb.textAlign === 'number') {
    const s = TEXT_ALIGN_ENUM[pb.textAlign];
    if (s !== undefined) ergo.textAlign = s;
    else delete ergo.textAlign;
  }
  if (typeof pb.font === 'number') {
    const s = FONT_ENUM[pb.font];
    if (s !== undefined) ergo.font = s;
    else delete ergo.font;
  }
  return ergo;
}
