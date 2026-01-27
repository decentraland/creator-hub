import type { WorldScene } from '/@/lib/worlds';
import { idToCoords } from '/@/lib/land';

export type WorldDimensions = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

export function getWorldDimensions(worldScenes: WorldScene[]): WorldDimensions {
  if (!worldScenes || worldScenes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX: number | null = null;
  let maxX: number | null = null;
  let minY: number | null = null;
  let maxY: number | null = null;

  worldScenes.forEach(scene => {
    scene.parcels?.forEach(parcel => {
      const [x, y] = idToCoords(parcel);
      const numX = Number(x);
      const numY = Number(y);

      minX = minX !== null ? Math.min(minX, numX) : numX;
      maxX = maxX !== null ? Math.max(maxX, numX) : numX;
      minY = minY !== null ? Math.min(minY, numY) : numY;
      maxY = maxY !== null ? Math.max(maxY, numY) : numY;
    });
  });

  const width = maxX !== null && minX !== null ? maxX - minX + 1 : 0;
  const height = maxY !== null && minY !== null ? maxY - minY + 1 : 0;

  return {
    minX: minX ?? 0,
    maxX: maxX ?? 0,
    minY: minY ?? 0,
    maxY: maxY ?? 0,
    width,
    height,
  };
}
