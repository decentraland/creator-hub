// Anchoring is a LIVE PIN, one per axis: each axis writes the EDGE it is pinned
// to, so the node stays glued to that edge while the PARENT resizes.
//   left / top      → position{Left,Top}: 0px    (trailing edge cleared)
//   right / bottom  → position{Right,Bottom}: 0px (leading edge cleared)
//   center / middle → position{Left,Top}: 50% plus a counter-margin of half the
//                     node's own measured size — the standard pre-transform CSS
//                     centering trick. It survives parent resizes; it drifts if
//                     the NODE's size changes (including a node sized in %, which
//                     resizes with its parent), until the pin is picked again.
// Reading is an EXACT match on the authored shape (which edge carries which
// unit), so no measuring and no tolerance is involved. `positionLeft: 123` reads
// as left-pinned — which is what a freehand canvas drag produces, and honest: a
// dragged absolute node genuinely is pinned to its top-left.

import {
  YGPT_ABSOLUTE as POSITION_ABSOLUTE,
  YGU_PERCENT,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../lib/sdk/ui-transform-constants';

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

// `offset` is where the pinned edge sits in px — 0 for an anchor pick, the dropped
// position for a canvas drag. `size` is the node's extent along the axis, used
// only by the centered pin's counter-margin.
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

// Pin ONE axis: picking `Center` horizontally must leave a vertical pin alone.
export function anchorPatch(pin: AnchorPin, elem: Size): Record<string, unknown> {
  return isH(pin) ? axisPatch(H_AXIS, pin, 0, elem.width) : axisPatch(V_AXIS, pin, 0, elem.height);
}

// A canvas drag/resize commits where the node was DROPPED (measured on screen), so
// it lands as a plain top-left px pin: the trailing edges and any centering
// counter-margin have to go, or the node ends up doubly pinned — Yoga adds the
// leading margin to the leading position, and a surviving right/bottom edge
// fights the new left/top.
export function dragPinPatch(top: number, left: number): Record<string, unknown> {
  return {
    ...axisPatch(H_AXIS, 'left', left),
    ...axisPatch(V_AXIS, 'top', top),
  };
}

function readAxis<Pin extends AnchorPin>(t: Record<string, unknown>, axis: Axis<Pin>): Pin | null {
  const unit = (key: string) => t[`${key}Unit`] as number | undefined;
  const lead = `position${axis.lead}`;
  if (
    unit(lead) === YGU_PERCENT &&
    t[lead] === CENTER_PERCENT &&
    unit(`margin${axis.lead}`) === YGU_POINT &&
    ((t[`margin${axis.lead}`] as number | undefined) ?? 0) < 0
  ) {
    return axis.pins.center;
  }
  if (unit(lead) === YGU_POINT) return axis.pins.lead;
  if (unit(`position${axis.trail}`) === YGU_POINT) return axis.pins.trail;
  return null;
}

// Which pin each axis reads as — null for an axis with no pinned edge, and both
// null for a node that isn't absolute (Yoga ignores the edges in flow). The
// leading edge wins when both are authored, matching how Yoga and CSS resolve a
// left+right pair.
export function readAnchor(t: Record<string, unknown> | null): {
  h: AnchorH | null;
  v: AnchorV | null;
} {
  if (!t || t.positionType !== POSITION_ABSOLUTE) return { h: null, v: null };
  return { h: readAxis(t, H_AXIS), v: readAxis(t, V_AXIS) };
}

// The counter-margins a centered pin owns, cleared when the node stops being
// anchored (dropped back into the layout flow): they are half the node's own
// width/height, which in flow reads as an unexplained overlap with its siblings.
// Margins on any other edge — and on an axis that isn't centered — are left alone.
export function clearedCenterMargins(t: Record<string, unknown> | null): Record<string, unknown> {
  const { h, v } = readAnchor(t);
  const patch: Record<string, unknown> = {};
  if (h === 'center') clear(patch, 'marginLeft');
  if (v === 'middle') clear(patch, 'marginTop');
  return patch;
}
