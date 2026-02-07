import { type Coords, idToCoords } from '/@/lib/land';

export const MIN_COORDINATE = -150;
export const MAX_COORDINATE = 150;

export type WorldDimensions = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

export function getBaseParcel(parcels: string[]): Coords | null {
  if (!parcels?.length) return null;
  let baseParcel = { x: MAX_COORDINATE, y: MAX_COORDINATE };
  parcels.forEach(parcel => {
    const [x, y] = idToCoords(parcel);
    if (Number(x) < baseParcel.x || Number(y) < baseParcel.y) {
      baseParcel = { x: Number(x), y: Number(y) };
    }
  });
  return [baseParcel.x, baseParcel.y];
}

export function getWorldDimensions(worldScenes: { parcels: string[] }[]): WorldDimensions {
  const parcels = new Set<string>(worldScenes?.flatMap(scene => scene.parcels ?? []) ?? []);
  if (parcels.size === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };

  let minX: number = MAX_COORDINATE;
  let minY: number = MAX_COORDINATE;
  let maxX: number = MIN_COORDINATE;
  let maxY: number = MIN_COORDINATE;

  Array.from(parcels).forEach(parcel => {
    const [x, y] = idToCoords(parcel);
    minX = Math.min(minX, Number(x));
    maxX = Math.max(maxX, Number(x));
    minY = Math.min(minY, Number(y));
    maxY = Math.max(maxY, Number(y));
  });

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  return { minX, maxX, minY, maxY, width, height };
}

export function formatWorldSize({ width, height }: { width: number; height: number }): string {
  if (width <= 0 || height <= 0) return '';
  return `${width}x${height}`;
}
