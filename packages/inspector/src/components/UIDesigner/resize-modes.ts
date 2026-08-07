// The Layout "Resize" control: a per-axis mode selector (Fixed px / Percent /
// Hug / Fill) over the width and height length pairs.
//
// Hug is Yoga's `auto` — the box is sized from its content, so the number stops
// meaning anything and the input goes disabled.
//
// Fill is the one that is not a single prop. `flexGrow` grows an item along its
// PARENT's MAIN axis only, so filling the CROSS axis has to go through
// `alignSelf: 'stretch'` instead. Which of width/height is "main" therefore
// depends on the parent's `flexDirection` — a value the node's own component
// cannot supply, so the panel reads it from the tree and passes it in (see
// PropertyPanel; the same reason `hideOnRoot` is resolved there rather than in a
// `hiddenWhen`).
//
// One classifier serves both directions of the control: the dropdown asks what
// an axis currently reads as, and the raw `Flex grow` / `Align self` rows ask
// whether Fill is already speaking for their prop. Sharing it is what stops the
// two drifting into a state where a value is driven by two live controls — or,
// worse, held in source with no control showing it.

import {
  YGA_STRETCH,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
} from '../../lib/sdk/ui-transform-constants';
import { flowValue } from './flow';

export type ResizeMode = 'fixed' | 'percent' | 'hug' | 'fill';
export type ResizeAxis = 'width' | 'height';

// The `flexGrow` value Fill writes. Any other non-zero grow is a share the
// binary Fill mode cannot express, which is what keeps the raw row reachable.
const FILL_GROW = 1;

const ALL_MODES: ResizeMode[] = ['fixed', 'percent', 'hug', 'fill'];

export const MODE_LABELS: Record<ResizeMode, string> = {
  fixed: 'Fixed',
  percent: 'Percent',
  hug: 'Hug',
  fill: 'Fill',
};

// YGFlexDirection: column (1) and column-reverse (2) run the main axis
// vertically; row (0) and row-reverse (3) run it horizontally. Reverse only
// flips the DIRECTION along the axis, not which axis it is.
export function mainAxisFor(parentFlexDirection: number): ResizeAxis {
  return parentFlexDirection === 1 || parentFlexDirection === 2 ? 'height' : 'width';
}

export const crossAxisOf = (mainAxis: ResizeAxis): ResizeAxis =>
  mainAxis === 'width' ? 'height' : 'width';

// A length is authored iff its unit companion is, since the two are always
// written together (ecs-shape `ergonomicToPBTransform`).
function axisSized(transform: Record<string, unknown>, axis: ResizeAxis): boolean {
  const unit = transform[`${axis}Unit`];
  return unit === YGU_POINT || unit === YGU_PERCENT || unit === YGU_AUTO;
}

/**
 * Whether `axis` is currently filling. Requires the axis to have NO size of its
 * own: in Yoga an explicit size wins over both `flexGrow` and `stretch`, so a
 * node with both is Fixed carrying an inert grow, not Fill. Also requires the
 * node to be in flow — Yoga ignores `flexGrow` and `alignSelf` on an absolutely
 * positioned node, so reading those as Fill there would show a mode that does
 * nothing.
 */
export function fillsAxis(
  transform: Record<string, unknown> | null,
  axis: ResizeAxis,
  mainAxis: ResizeAxis,
): boolean {
  const t = transform ?? {};
  if (flowValue(t) === 'absolute') return false;
  if (axisSized(t, axis)) return false;
  return axis === mainAxis ? t.flexGrow === FILL_GROW : t.alignSelf === YGA_STRETCH;
}

/**
 * The mode an axis reads as. An axis with nothing authored reads as Fixed,
 * matching how every other length field surfaces an unset value (px, 0) — Hug
 * would be closer to Yoga's own default but would make a fresh node's size
 * uneditable until the mode was changed first.
 */
export function resizeMode(
  transform: Record<string, unknown> | null,
  axis: ResizeAxis,
  mainAxis: ResizeAxis,
): ResizeMode {
  const t = transform ?? {};
  const unit = t[`${axis}Unit`];
  if (unit === YGU_AUTO) return 'hug';
  if (unit === YGU_PERCENT) return 'percent';
  if (fillsAxis(t, axis, mainAxis)) return 'fill';
  return 'fixed';
}

/**
 * Which modes to offer. Fill is flex-fill, which Yoga applies only to a node in
 * flow; an absolute node keeps Fixed / Percent / Hug (`auto` IS honoured on an
 * absolute node — it sizes from the content there too).
 *
 * `overriding` — editing a non-base interaction layer — withholds it too. Entering
 * Fill means REMOVING the axis size, and in an override layer a removed key means
 * "inherit from Default", not "unset": Default's size would keep winning, the
 * classifier would still read Fixed, and the dropdown would snap back leaving an
 * inert `flexGrow` behind. Passing `current` keeps a node that already reads Fill
 * from Default showing it, so the mode on screen is never absent from its own list.
 */
export function resizeModesFor(
  transform: Record<string, unknown> | null,
  opts: { overriding?: boolean; current?: ResizeMode } = {},
): ResizeMode[] {
  const offerFill =
    flowValue(transform ?? {}) !== 'absolute' && (!opts.overriding || opts.current === 'fill');
  return offerFill ? ALL_MODES : ALL_MODES.filter(m => m !== 'fill');
}

const UNIT_FOR_MODE: Partial<Record<ResizeMode, number>> = {
  fixed: YGU_POINT,
  percent: YGU_PERCENT,
  hug: YGU_AUTO,
};

/** The patch for typing a new number on an axis, keeping its current mode. */
export function resizeValuePatch(
  axis: ResizeAxis,
  mode: ResizeMode,
  value: number,
): Record<string, unknown> {
  return { [axis]: value, [`${axis}Unit`]: UNIT_FOR_MODE[mode] ?? YGU_POINT };
}

/**
 * The patch for picking `next` on `axis`. `value` is the number to carry into the
 * two numeric modes (the caller converts it against the measured parent box).
 *
 * Leaving Fill clears exactly the prop THAT axis borrowed and nothing else —
 * clearing both unconditionally would destroy a hand-authored `alignSelf:
 * 'center'` on an axis that never filled.
 */
export function resizePatch(args: {
  next: ResizeMode;
  current: ResizeMode;
  axis: ResizeAxis;
  mainAxis: ResizeAxis;
  value: number;
}): Record<string, unknown> {
  const { next, current, axis, mainAxis, value } = args;
  const fillProp = axis === mainAxis ? 'flexGrow' : 'alignSelf';
  const patch: Record<string, unknown> = {};
  if (current === 'fill') patch[fillProp] = undefined;
  if (next === 'fill') {
    patch[axis] = undefined;
    patch[`${axis}Unit`] = undefined;
    patch[fillProp] = axis === mainAxis ? FILL_GROW : YGA_STRETCH;
    return patch;
  }
  return { ...patch, ...resizeValuePatch(axis, next, value) };
}

/**
 * Whether the Resize control's Fill mode is currently speaking for a raw prop's
 * row, which is the one state that row must stay out of. A thin read over the
 * same `fillsAxis` the dropdown uses, so the row gate cannot drift from the mode
 * it is hiding behind. Resolved by the panel rather than a `hiddenWhen` because
 * it needs the PARENT's direction.
 */
export function fillOwnsProp(
  path: string,
  transform: Record<string, unknown> | null,
  parentFlexDirection: number,
): boolean {
  const mainAxis = mainAxisFor(parentFlexDirection);
  if (path === 'flexGrow') return fillsAxis(transform, mainAxis, mainAxis);
  if (path === 'alignSelf') return fillsAxis(transform, crossAxisOf(mainAxis), mainAxis);
  return false;
}
