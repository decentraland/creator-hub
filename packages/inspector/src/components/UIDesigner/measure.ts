import type { Entity } from '@dcl/ecs';

import { getNodeElement } from './node-registry';

// The EDITOR zoom: the factor between viewport px and the logical (Yoga) px every
// conversion here works in. It lives with the measuring rather than in the Canvas
// component so that reading it doesn't import the whole canvas back; the Canvas
// writes it when the user zooms or the viewport refits.
export const DEFAULT_CANVAS_SCALE = 0.4;

let canvasScale = DEFAULT_CANVAS_SCALE;

export function getCanvasScale(): number {
  return canvasScale;
}

export function setCanvasScale(scale: number): void {
  canvasScale = scale;
}

// Sum of computed lengths on an element, in logical (Yoga) px. Computed style is
// ALREADY logical: the canvas scales itself with a CSS transform, which changes
// what a rect measures but never a declared length — so these are the one
// measurement in this module that must not be divided by the canvas scale.
function cssPx(style: CSSStyleDeclaration, ...props: string[]): number {
  return props.reduce((sum, prop) => sum + (parseFloat(style.getPropertyValue(prop)) || 0), 0);
}

// Measure the box the node's percentages resolve against — its CONTAINING BLOCK,
// which is not the parent's outer box. Yoga mirrors CSS: an absolute node resolves
// against the parent's padding box (border subtracted), one in flow against the
// parent's content box (border and padding subtracted).
// Returns null when the node isn't in the canvas DOM or the parent has no size.
export function measureParentBox(entity: Entity): { width: number; height: number } | null {
  const el = getNodeElement(entity);
  const parent = el?.parentElement;
  if (!el || !parent) return null;
  const r = parent.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const style = getComputedStyle(parent);
  const inFlow = getComputedStyle(el).position !== 'absolute';
  const edges = (...props: string[]) => cssPx(style, ...props);
  const scale = getCanvasScale();
  return {
    width:
      r.width / scale -
      edges('border-left-width', 'border-right-width') -
      (inFlow ? edges('padding-left', 'padding-right') : 0),
    height:
      r.height / scale -
      edges('border-top-width', 'border-bottom-width') -
      (inFlow ? edges('padding-top', 'padding-bottom') : 0),
  };
}

// Measure the rendered box of the node itself, in logical (Yoga) px. Used by the
// anchor grid to compute concrete px positions (and to detect the active cell).
export function measureNodeBox(entity: Entity): { width: number; height: number } | null {
  const el = getNodeElement(entity);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const scale = getCanvasScale();
  return { width: r.width / scale, height: r.height / scale };
}

// The node's rendered offset from the origin an absolute INSET is measured from:
// the parent's padding box — inside its border, but NOT inside its padding. Yoga
// lays out an absolute node with a defined inset at `parent leading border + inset
// + own leading margin` (yoga/algorithm/AbsoluteLayout.cpp; the parent's padding
// only joins in for the no-inset static-position case), and CSS says the same by
// making the containing block the padding box. Measuring from the parent's OUTER
// edge instead makes every convert-to-absolute and every drop inside a bordered
// parent jump by that border.
export function offsetInParent(
  el: HTMLElement,
  parent: HTMLElement,
): { top: number; left: number } {
  const elRect = el.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const parentStyle = getComputedStyle(parent);
  const scale = getCanvasScale();
  return {
    top: (elRect.top - parentRect.top) / scale - cssPx(parentStyle, 'border-top-width'),
    left: (elRect.left - parentRect.left) / scale - cssPx(parentStyle, 'border-left-width'),
  };
}

// Which parent dimension a length path is a percentage of.
// A margin or padding is a percentage of the containing block's WIDTH on BOTH
// axes — CSS says so, and Yoga follows it in its signatures: `computeFlexStartMargin`
// and `computeFlexStartPadding` take a `widthSize` whatever the axis, while an
// inset's `computeFlexStartPosition` takes that axis's own size. So only
// height/top/bottom paths that are NOT box-model edges resolve against height.
export function axisForPath(path: string): 'width' | 'height' {
  if (/^(margin|padding)/.test(path)) return 'width';
  return /height|top|bottom/i.test(path) ? 'height' : 'width';
}

// Convert a length between YGUnit POINT(1) and PERCENT(2) against `parentDim`.
// Returns the value unchanged when units match or the parent size is unknown.
export function convertLength(
  value: number,
  fromUnit: number,
  toUnit: number,
  parentDim: number,
): number {
  if (fromUnit === toUnit || !parentDim) return value;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (fromUnit === 1 && toUnit === 2) return round2((value / parentDim) * 100); // px → %
  if (fromUnit === 2 && toUnit === 1) return round2((value / 100) * parentDim); // % → px
  return value;
}
