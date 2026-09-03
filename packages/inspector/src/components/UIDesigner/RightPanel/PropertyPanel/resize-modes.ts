import {
  YGA_STRETCH,
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
} from '../../../../lib/sdk/ui-transform-constants';

export type ResizeMode = 'fixed' | 'percent' | 'hug' | 'fill';
export type ResizeAxis = 'width' | 'height';

const FILL_GROW = 1;

const isAbsolute = (t: Record<string, unknown>): boolean =>
  ((t.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;

const ALL_MODES: ResizeMode[] = ['fixed', 'percent', 'hug', 'fill'];

export const MODE_LABELS: Record<ResizeMode, string> = {
  fixed: 'Fixed',
  percent: 'Percent',
  hug: 'Hug',
  fill: 'Fill',
};

export function mainAxisFor(parentFlexDirection: number): ResizeAxis {
  return parentFlexDirection === 1 || parentFlexDirection === 2 ? 'height' : 'width';
}

export const crossAxisOf = (mainAxis: ResizeAxis): ResizeAxis =>
  mainAxis === 'width' ? 'height' : 'width';

function axisSized(transform: Record<string, unknown>, axis: ResizeAxis): boolean {
  const unit = transform[`${axis}Unit`];
  return unit === YGU_POINT || unit === YGU_PERCENT || unit === YGU_AUTO;
}

/** Whether `axis` is currently filling. Requires the axis to have no size of its own and the node to be in flow. */
export function fillsAxis(
  transform: Record<string, unknown> | null,
  axis: ResizeAxis,
  mainAxis: ResizeAxis,
): boolean {
  const t = transform ?? {};
  if (isAbsolute(t)) return false;
  if (axisSized(t, axis)) return false;
  return axis === mainAxis ? t.flexGrow === FILL_GROW : t.alignSelf === YGA_STRETCH;
}

/** The mode an axis reads as. An axis with nothing authored reads as Fixed. */
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

/** Which modes to offer. Fill is offered only for an in-flow node (or one already reading Fill from Default while overriding). */
export function resizeModesFor(
  transform: Record<string, unknown> | null,
  opts: { overriding?: boolean; current?: ResizeMode } = {},
): ResizeMode[] {
  const offerFill = !isAbsolute(transform ?? {}) && (!opts.overriding || opts.current === 'fill');
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

/** The patch for picking `next` on `axis`; leaving Fill clears exactly the prop that axis borrowed and nothing else. */
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

/** Whether the Resize control's Fill mode is currently speaking for a raw prop's row. */
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
