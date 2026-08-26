
import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../../lib/sdk/ui-transform-constants';
import { clearedCenterMargins } from '../../shared/align-presets';

export const FLOW_DIRECTIONS = {
  row: 0,
  column: 1,
  'column-reverse': 2,
  'row-reverse': 3,
} as const;

export type FlowDirection = keyof typeof FLOW_DIRECTIONS;
export type FlowValue = 'absolute' | FlowDirection;

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
 * → Absolute. ANCHORS the node to its parent's leading edges (Top/Left 0) and
 * clears the opposite edges so nothing stale survives.
 *
 * It deliberately does NOT bake the node's measured offset. The Anchor row reads
 * any POINT-unit leading edge as a Left/Top pin whatever its value, so baking
 * `left: 950` left the panel claiming an anchor the canvas plainly was not
 * honouring — the pin only became real once the author picked one by hand. Going
 * absolute therefore moves the node, and the Anchor row is immediately true.
 *
 * The margins go with it: Yoga adds the leading margin on top of an absolute
 * node's leading inset, so a surviving margin holds the node off the very edge it
 * is now pinned to. All four go, not just the leading pair, so that `Position`
 * keeps meaning the node's visible offset: every later position edit and canvas
 * drag reads it that way. Authored margins are not recoverable — `inFlowPatch`
 * has nowhere to restore them from.
 */
export function absolutePatch() {
  return {
    positionType: YGPT_ABSOLUTE,
    positionTop: 0,
    positionTopUnit: YGU_POINT,
    positionLeft: 0,
    positionLeftUnit: YGU_POINT,
    positionRight: 0,
    positionRightUnit: YGU_UNDEFINED,
    positionBottom: 0,
    positionBottomUnit: YGU_UNDEFINED,
    marginTop: 0,
    marginTopUnit: YGU_UNDEFINED,
    marginRight: 0,
    marginRightUnit: YGU_UNDEFINED,
    marginBottom: 0,
    marginBottomUnit: YGU_UNDEFINED,
    marginLeft: 0,
    marginLeftUnit: YGU_UNDEFINED,
  };
}

/**
 * → In flow. Clears the baked offsets: Yoga applies `position*` to RELATIVE
 * nodes too, so leaving them behind would shift the node inside the flow. A
 * centered anchor's counter-margin shifts it the same way, but only exists on
 * some nodes — callers merge in `clearedCenterMargins` for that.
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
  transform: Record<string, unknown> | null = null,
): Record<string, unknown> | null {
  if (next === current) return null;
  if (next === 'absolute') return absolutePatch();
  const patch: Record<string, unknown> = { flexDirection: FLOW_DIRECTIONS[next] };
  if (current === 'absolute') {
    Object.assign(patch, inFlowPatch(), clearedCenterMargins(transform));
  }
  return patch;
}

/** Wrap-reverse counts as wrapping, so the toggle reads any non-zero as on. */
export function isWrapping(transform: Record<string, unknown> | null): boolean {
  return (((transform ?? {}).flexWrap as number | undefined) ?? YGW_NO_WRAP) !== YGW_NO_WRAP;
}

export function wrapPatch(on: boolean): Record<string, unknown> {
  return { flexWrap: on ? YGW_WRAP : YGW_NO_WRAP };
}


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
