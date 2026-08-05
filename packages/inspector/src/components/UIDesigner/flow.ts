// The Layout "Flow" control: one 5-way exclusive selector over TWO orthogonal
// UiTransform props, plus a separate wrap toggle.
//
// `positionType` is how I sit in MY PARENT (an item prop); `flexDirection` is how
// I arrange MY CHILDREN (a container prop). Yoga treats them independently — an
// absolutely-positioned container still lays its own children out by
// `flexDirection` — so the 2 x 4 state space cannot be *displayed* by a 5-way
// control. It does not have to be: the direction simply isn't shown while
// absolute is active, and `Flex direction` stays reachable as its own row (a
// non-core field renders whenever it is authored, and lives in the group's
// `+ Add property` menu otherwise).
//
// The one rule that makes that safe: picking `absolute` must never clear
// `flexDirection` in source. See `flowPatch`.

import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../lib/sdk/ui-transform-constants';

// YGFlexDirection, keyed by the react-ecs value name.
export const FLOW_DIRECTIONS = {
  row: 0,
  column: 1,
  'column-reverse': 2,
  'row-reverse': 3,
} as const;

export type FlowDirection = keyof typeof FLOW_DIRECTIONS;
export type FlowValue = 'absolute' | FlowDirection;

// YGWrap
export const YGW_NO_WRAP = 0;
export const YGW_WRAP = 1;
export const YGW_WRAP_REVERSE = 2;

const DIRECTION_NAMES = Object.keys(FLOW_DIRECTIONS) as FlowDirection[];

/** The selector cell the current UiTransform reads as. */
export function flowValue(transform: Record<string, unknown> | null): FlowValue {
  const t = transform ?? {};
  if (((t.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE) {
    return 'absolute';
  }
  const direction = (t.flexDirection as number | undefined) ?? FLOW_DIRECTIONS.row;
  return DIRECTION_NAMES.find(name => FLOW_DIRECTIONS[name] === direction) ?? 'row';
}

/**
 * → Absolute. Bakes the node's current on-screen offset as Top/Left px so
 * switching modes never moves it, and clears the opposite edges so nothing stale
 * survives. `offset` comes from measuring the canvas (see measure.ts).
 */
export function absolutePatch(offset: { top: number; left: number } | null) {
  return {
    positionType: YGPT_ABSOLUTE,
    positionTop: offset?.top ?? 0,
    positionTopUnit: YGU_POINT,
    positionLeft: offset?.left ?? 0,
    positionLeftUnit: YGU_POINT,
    positionRight: 0,
    positionRightUnit: YGU_UNDEFINED,
    positionBottom: 0,
    positionBottomUnit: YGU_UNDEFINED,
  };
}

/**
 * → In flow. Clears the baked offsets: Yoga applies `position*` to RELATIVE
 * nodes too, so leaving them behind would shift the node inside the flow.
 */
export function inFlowPatch() {
  return {
    positionType: YGPT_RELATIVE,
    positionTop: 0,
    positionTopUnit: YGU_UNDEFINED,
    positionRight: 0,
    positionRightUnit: YGU_UNDEFINED,
    positionBottom: 0,
    positionBottomUnit: YGU_UNDEFINED,
    positionLeft: 0,
    positionLeftUnit: YGU_UNDEFINED,
  };
}

/**
 * The patch for picking `next` in the Flow selector, or null when nothing
 * changes. Crucially, `absolute` writes NO `flexDirection` key — the direction is
 * hidden while absolute, not destroyed — and the in-flow offset reset only runs
 * on an actual mode change, so a direction pick never touches a relative node's
 * hand-authored position offsets.
 */
export function flowPatch(
  next: FlowValue,
  current: FlowValue,
  offset: { top: number; left: number } | null,
): Record<string, unknown> | null {
  if (next === current) return null;
  if (next === 'absolute') return absolutePatch(offset);
  const patch: Record<string, unknown> = { flexDirection: FLOW_DIRECTIONS[next] };
  if (current === 'absolute') Object.assign(patch, inFlowPatch());
  return patch;
}

/** Wrap-reverse counts as wrapping, so the toggle reads any non-zero as on. */
export function isWrapping(transform: Record<string, unknown> | null): boolean {
  return (((transform ?? {}).flexWrap as number | undefined) ?? YGW_NO_WRAP) !== YGW_NO_WRAP;
}

export function wrapPatch(on: boolean): Record<string, unknown> {
  return { flexWrap: on ? YGW_WRAP : YGW_NO_WRAP };
}

// --- Which raw rows the Flow control speaks for ---
//
// The panel shows a single-prop row only when the combined control cannot
// represent the current value, so that no value is ever driven by two live
// controls at once. These are those predicates.

/**
 * Whether the 5-way selector can DISPLAY the node's `flexDirection`. It shows one
 * cell, so while the node is absolute the direction is held in source but off
 * screen — the only state where the raw `Flex direction` row earns its place.
 */
export function directionIsRepresentable(transform: Record<string, unknown> | null): boolean {
  return flowValue(transform) !== 'absolute';
}

/**
 * Whether the wrap toggle can represent `flexWrap`. It is binary, so it covers
 * nowrap and wrap but not `wrap-reverse`.
 */
export function wrapIsRepresentable(transform: Record<string, unknown> | null): boolean {
  return (((transform ?? {}).flexWrap as number | undefined) ?? YGW_NO_WRAP) !== YGW_WRAP_REVERSE;
}
