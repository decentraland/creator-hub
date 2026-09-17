import {
  YGPT_ABSOLUTE as POSITION_ABSOLUTE,
  YGU_PERCENT,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../lib/sdk/ui-transform-constants';

export type AnchorH = 'left' | 'center' | 'right';
export type AnchorV = 'top' | 'middle' | 'bottom';
export type AnchorPin = AnchorH | AnchorV;

interface Size {
  width: number;
  height: number;
}

const CENTER_PERCENT = 50;

interface Axis<Pin extends AnchorPin> {
  lead: 'Left' | 'Top';
  trail: 'Right' | 'Bottom';
  pins: { lead: Pin; center: Pin; trail: Pin };
}

const H_AXIS: Axis<AnchorH> = {
  lead: 'Left',
  trail: 'Right',
  pins: { lead: 'left', center: 'center', trail: 'right' },
};

const V_AXIS: Axis<AnchorV> = {
  lead: 'Top',
  trail: 'Bottom',
  pins: { lead: 'top', center: 'middle', trail: 'bottom' },
};

const isH = (pin: AnchorPin): pin is AnchorH =>
  pin === 'left' || pin === 'center' || pin === 'right';

function len(patch: Record<string, unknown>, key: string, value: number, unit: number): void {
  patch[key] = value;
  patch[`${key}Unit`] = unit;
}

const clear = (patch: Record<string, unknown>, key: string): void =>
  len(patch, key, 0, YGU_UNDEFINED);

function axisPatch<Pin extends AnchorPin>(
  axis: Axis<Pin>,
  pin: Pin,
  offset: number,
  size = 0,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { positionType: POSITION_ABSOLUTE };
  clear(patch, `margin${axis.lead}`);
  clear(patch, `margin${axis.trail}`);
  if (pin === axis.pins.trail) {
    clear(patch, `position${axis.lead}`);
    len(patch, `position${axis.trail}`, offset, YGU_POINT);
    return patch;
  }
  clear(patch, `position${axis.trail}`);
  if (pin === axis.pins.center) {
    len(patch, `position${axis.lead}`, CENTER_PERCENT, YGU_PERCENT);
    len(patch, `margin${axis.lead}`, -Math.round(size / 2), YGU_POINT);
  } else {
    len(patch, `position${axis.lead}`, offset, YGU_POINT);
  }
  return patch;
}

/** Pin one axis, leaving the other axis's pin untouched. */
export function anchorPatch(pin: AnchorPin, elem: Size): Record<string, unknown> {
  return isH(pin) ? axisPatch(H_AXIS, pin, 0, elem.width) : axisPatch(V_AXIS, pin, 0, elem.height);
}

/** Patch committing a canvas drag/resize as a top-left px pin at the drop point. */
export function dragPinPatch(
  top: number,
  left: number,
  transform: Record<string, unknown> | null,
): Record<string, unknown> {
  const cleared = clearedCenterMargins(transform);
  const patch: Record<string, unknown> = { positionType: POSITION_ABSOLUTE };
  for (const [axis, offset] of [
    [H_AXIS, left],
    [V_AXIS, top],
  ] as const) {
    const margin = `margin${axis.lead}`;
    const surviving = margin in cleared ? 0 : pointLength(transform, margin);
    len(patch, `position${axis.lead}`, Math.round(offset - surviving), YGU_POINT);
    clear(patch, `position${axis.trail}`);
  }
  return { ...patch, ...cleared };
}

function pointLength(t: Record<string, unknown> | null, key: string): number {
  if (!t || t[`${key}Unit`] !== YGU_POINT) return 0;
  return (t[key] as number | undefined) ?? 0;
}

/** The frame the canvas holds optimistically while the drag splice round-trips. */
export function dragPinHold(
  top: number,
  left: number,
  transform: Record<string, unknown> | null,
): { top: number; left: number; marginTop?: number; marginLeft?: number } {
  const patch = dragPinPatch(top, left, transform);
  return {
    top: patch.positionTop as number,
    left: patch.positionLeft as number,
    marginTop: 'marginTop' in patch ? 0 : undefined,
    marginLeft: 'marginLeft' in patch ? 0 : undefined,
  };
}

function readAxis<Pin extends AnchorPin>(t: Record<string, unknown>, axis: Axis<Pin>): Pin | null {
  const unit = (key: string) => t[`${key}Unit`] as number | undefined;
  const lead = `position${axis.lead}`;
  if (
    unit(lead) === YGU_PERCENT &&
    t[lead] === CENTER_PERCENT &&
    unit(`margin${axis.lead}`) === YGU_POINT &&
    ((t[`margin${axis.lead}`] as number | undefined) ?? 0) <= 0
  ) {
    return axis.pins.center;
  }
  if (unit(lead) === YGU_POINT) return axis.pins.lead;
  if (unit(`position${axis.trail}`) === YGU_POINT) return axis.pins.trail;
  return null;
}

/** Which pin each axis reads as, or null for an unpinned axis or non-absolute node. */
export function readAnchor(t: Record<string, unknown> | null): {
  h: AnchorH | null;
  v: AnchorV | null;
} {
  if (!t || t.positionType !== POSITION_ABSOLUTE) return { h: null, v: null };
  return { h: readAxis(t, H_AXIS), v: readAxis(t, V_AXIS) };
}

/** The centered-pin counter-margins to clear when a node leaves the layout flow. */
export function clearedCenterMargins(t: Record<string, unknown> | null): Record<string, unknown> {
  const { h, v } = readAnchor(t);
  const patch: Record<string, unknown> = {};
  if (h === 'center') clear(patch, 'marginLeft');
  if (v === 'middle') clear(patch, 'marginTop');
  return patch;
}
