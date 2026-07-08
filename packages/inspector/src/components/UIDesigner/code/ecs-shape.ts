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
