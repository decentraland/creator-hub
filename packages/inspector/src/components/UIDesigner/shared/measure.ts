import type { Entity } from '@dcl/ecs';

import { getNodeElement } from './node-registry';

/** The editor zoom: the factor between viewport px and the logical (Yoga) px conversions work in. */
export const DEFAULT_CANVAS_SCALE = 0.4;

let canvasScale = DEFAULT_CANVAS_SCALE;

export function getCanvasScale(): number {
  return canvasScale;
}

export function setCanvasScale(scale: number): void {
  canvasScale = scale;
}

function cssPx(style: CSSStyleDeclaration, ...props: string[]): number {
  return props.reduce((sum, prop) => sum + (parseFloat(style.getPropertyValue(prop)) || 0), 0);
}

/** Measure the box a node's percentages resolve against — its containing block. */
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

/** Measure the node's own rendered box, in logical (Yoga) px. */
export function measureNodeBox(entity: Entity): { width: number; height: number } | null {
  const el = getNodeElement(entity);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const scale = getCanvasScale();
  return { width: r.width / scale, height: r.height / scale };
}

/** The node's rendered offset from the parent's padding box (inside border, outside padding). */
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

/** Which parent dimension a length path resolves its percentage against. */
export function axisForPath(path: string): 'width' | 'height' {
  if (/^(margin|padding)/.test(path)) return 'width';
  return /height|top|bottom/i.test(path) ? 'height' : 'width';
}

/** Convert a length between YGUnit POINT(1) and PERCENT(2) against `parentDim`. */
export function convertLength(
  value: number,
  fromUnit: number,
  toUnit: number,
  parentDim: number,
): number {
  if (fromUnit === toUnit || !parentDim) return value;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (fromUnit === 1 && toUnit === 2) return round2((value / parentDim) * 100);
  if (fromUnit === 2 && toUnit === 1) return round2((value / 100) * parentDim);
  return value;
}
