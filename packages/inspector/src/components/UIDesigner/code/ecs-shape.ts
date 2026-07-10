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

  return ergo;
}
