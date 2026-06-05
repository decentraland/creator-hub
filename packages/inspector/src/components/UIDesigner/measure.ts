import { CANVAS_SCALE } from './Canvas';

// Measure the rendered box of the selected node's PARENT, in logical (Yoga) px.
// Returns null when the node isn't in the canvas DOM or the parent has no size.
export function measureParentBox(entity: number): { width: number; height: number } | null {
  const id = Number(entity);
  if (!Number.isInteger(id)) return null;
  const el = document.querySelector(`[data-entity="${id}"]`);
  const parent = el?.parentElement;
  if (!parent) return null;
  const r = parent.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { width: r.width / CANVAS_SCALE, height: r.height / CANVAS_SCALE };
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
