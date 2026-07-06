import type { Entity } from '@dcl/ecs';

import { getCanvasScale } from './Canvas';
import { getNodeElement } from './node-registry';

// Measure the rendered box of the selected node's PARENT, in logical (Yoga) px.
// Returns null when the node isn't in the canvas DOM or the parent has no size.
export function measureParentBox(entity: Entity): { width: number; height: number } | null {
  const id = Number(entity);
  if (!Number.isInteger(id)) return null;
  const el = getNodeElement(entity);
  const parent = el?.parentElement;
  if (!parent) return null;
  const r = parent.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const scale = getCanvasScale();
  return { width: r.width / scale, height: r.height / scale };
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

// Measure the node's rendered offset RELATIVE TO ITS PARENT, in logical px.
// Same math as Canvas's drag-start capture (elRect vs parentRect, descaled).
export function measureNodeOffset(entity: Entity): { top: number; left: number } | null {
  const el = getNodeElement(entity);
  const parent = el?.parentElement;
  if (!el || !parent) return null;
  const elRect = el.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const scale = getCanvasScale();
  return {
    top: Math.round((elRect.top - parentRect.top) / scale),
    left: Math.round((elRect.left - parentRect.left) / scale),
  };
}

// Measure `child`'s rendered offset relative to ANOTHER entity's box (the
// prospective new parent), in logical px. Lets a reparent keep an absolute
// node at its on-screen position. Null when either element isn't mounted.
export function measureReparentOffset(
  child: Entity,
  newParent: Entity,
): { top: number; left: number } | null {
  const childEl = getNodeElement(child);
  const parentEl = getNodeElement(newParent);
  if (!childEl || !parentEl) return null;
  const c = childEl.getBoundingClientRect();
  const p = parentEl.getBoundingClientRect();
  const scale = getCanvasScale();
  return {
    top: Math.round((c.top - p.top) / scale),
    left: Math.round((c.left - p.left) / scale),
  };
}

// Which parent dimension a length path is a percentage of.
// height/top/bottom paths are a percentage of height; the rest of width.
export function axisForPath(path: string): 'width' | 'height' {
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
