import fs from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@dcl/schemas';

import { writeFile } from '../services/fs';

export type Coords = {
  x: number;
  y: number;
};

/**
 * Get Project's scene.json path
 */
function getScenePath(_path: string): string {
  return path.join(_path, 'scene.json');
}

/**
 * Get Project's scene JSON
 */
export async function getScene(_path: string): Promise<Scene> {
  const scene = await fs.readFile(getScenePath(_path), 'utf8');
  return sanitizeScene(JSON.parse(scene));
}

const DEFAULT_PARCEL = '0,0';
const PARCEL_REGEX = /^\s*-?\d+\s*,\s*-?\d+\s*$/;

function isValidParcel(value: unknown): value is string {
  return typeof value === 'string' && PARCEL_REGEX.test(value);
}

/**
 * Replaces invalid parcels/base values with defaults so a malformed scene.json
 * (e.g. numeric parcels like [0,0] instead of ["0,0"]) can't break project loading.
 */
export function sanitizeScene(scene: Scene): Scene {
  const rawParcels = Array.isArray(scene?.scene?.parcels) ? scene.scene.parcels : [];
  const parcels = rawParcels.filter(isValidParcel);
  const base = isValidParcel(scene?.scene?.base)
    ? scene.scene.base
    : (parcels[0] ?? DEFAULT_PARCEL);
  if (parcels.length === 0) parcels.push(base);
  return { ...scene, scene: { ...scene?.scene, parcels, base } };
}

/**
 * Write Project's scene JSON
 */
export async function writeScene({ path: _path, scene }: { path: string; scene: Scene }) {
  await writeFile(getScenePath(_path), JSON.stringify(scene, null, 2), { encoding: 'utf8' });
}

export function pathToPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

/**
 * Updates the scene metadata to reference the new thumbnail path.
 *
 * @param path - The path to the project directory.
 * @param thumbnailPath - The path to the newly saved thumbnail.
 */
export async function updateSceneThumbnail(path: string, thumbnailPath: string): Promise<void> {
  const scene = await getScene(path);
  await writeScene({
    path,
    scene: {
      ...scene,
      display: {
        ...scene.display,
        navmapThumbnail: pathToPosix(thumbnailPath),
      },
    },
  });
}

/**
 * Parses a string representing coordinates and returns an object with x and y properties.
 * @param {string} coords - A string representing coordinates in the format "x,y".
 * @returns {Coords} An object with numeric x and y properties.
 */
export function parseCoords(coords: string): Coords {
  const [x, y] = coords.split(',');
  return { x: parseInt(x, 10), y: parseInt(y, 10) };
}

/**
 * Calculates the number of rows and columns needed to encompass the given parcels.
 * @param {Coords[]} parcels - An array of coordinate objects.
 * @returns {{ rows: number, cols: number }} An object with the number of rows and columns.
 */
export function getRowsAndCols(parcels: Coords[]): {
  rows: number;
  cols: number;
} {
  if (!parcels.length) return { rows: 0, cols: 0 };

  const xs = parcels.map(({ x }) => x);
  const ys = parcels.map(({ y }) => y);

  return {
    rows: Math.max(...xs) - Math.min(...xs) + 1,
    cols: Math.max(...ys) - Math.min(...ys) + 1,
  };
}
