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

/** → Absolute. Anchors the node to its parent's leading edges (Top/Left 0) and clears the opposite edges and all margins. */
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

/** → In flow. Clears the baked offsets, which Yoga applies to relative nodes too. */
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

/** The patch for picking `next` in the Flow selector, or null when nothing changes. */
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

/** Whether the 5-way selector can DISPLAY the node's `flexDirection` (it cannot while the node is absolute). */
export function directionIsRepresentable(transform: Record<string, unknown> | null): boolean {
  return flowValue(transform) !== 'absolute';
}

/** Whether the wrap toggle can represent `flexWrap`. It is binary, so it cannot show `wrap-reverse`. */
export function wrapIsRepresentable(transform: Record<string, unknown> | null): boolean {
  return (((transform ?? {}).flexWrap as number | undefined) ?? YGW_NO_WRAP) !== YGW_WRAP_REVERSE;
}
