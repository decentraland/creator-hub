import { coordsToId } from '/@/lib/land';

export type Coord = { x: number; y: number };
export type Bounds = { min: Coord; max: Coord };
export type Allowed = Set<string> | Bounds;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Whether a parcel may be picked: a member of the set, or inside the bounds. */
export function isAllowed(allowed: Allowed, { x, y }: Coord) {
  if (allowed instanceof Set) return allowed.has(coordsToId(x, y));
  const { min, max } = allowed;
  return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
}

const STEPS = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
} as const;

export type Direction = keyof typeof STEPS;

export const isDirection = (key: string): key is Direction => Object.hasOwn(STEPS, key);

export const toCoord = (id: string): Coord => {
  const [x, y] = id.split(',').map(Number);
  return { x, y };
};

export const toId = ({ x, y }: Coord) => coordsToId(x, y);

/** The allowed parcel nearest `from` in `direction`: its own row or column first, then the closest in that half-plane. */
export function nextParcel(from: Coord, direction: Direction, allowed: Allowed) {
  const step = STEPS[direction];
  if (!(allowed instanceof Set)) {
    const to = { x: from.x + step.x, y: from.y + step.y };
    return isAllowed(allowed, to) ? to : null;
  }
  let best: { coord: Coord; offAxis: boolean; distance: number } | null = null;
  for (const id of allowed) {
    const coord = toCoord(id);
    const along = (coord.x - from.x) * step.x + (coord.y - from.y) * step.y;
    if (along <= 0) continue;
    const across = Math.abs(step.x ? coord.y - from.y : coord.x - from.x);
    const candidate = { coord, offAxis: across > 0, distance: along + across };
    if (
      !best ||
      (best.offAxis && !candidate.offAxis) ||
      (best.offAxis === candidate.offAxis && candidate.distance < best.distance)
    ) {
      best = candidate;
    }
  }
  return best?.coord ?? null;
}

/** The allowed parcel nearest `point`. */
export function nearestParcel(point: Coord, allowed: Allowed) {
  if (!(allowed instanceof Set))
    return {
      x: clamp(point.x, allowed.min.x, allowed.max.x),
      y: clamp(point.y, allowed.min.y, allowed.max.y),
    };
  let best: { coord: Coord; distance: number } | null = null;
  for (const id of allowed) {
    const coord = toCoord(id);
    const distance = Math.abs(coord.x - point.x) + Math.abs(coord.y - point.y);
    if (!best || distance < best.distance) best = { coord, distance };
  }
  return best?.coord ?? null;
}
