import { Vector3 } from '@babylonjs/core';

import type { SceneSpawnPoint, SceneSpawnPointCoord } from '../../../lib/sdk/components';
import { inBounds } from '../../../lib/utils/layout';
import type { Layout } from '../../../lib/utils/layout';
import type { SpawnPointInput } from './types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getValue(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range') {
    if (coord.value.length === 1) return coord.value[0];
    return round2((coord.value[0] + coord.value[1]) / 2);
  }
  return coord.value;
}

function getOffset(value: number | number[]): number {
  if (Array.isArray(value) && value.length > 1) {
    return round2((value[1] - value[0]) / 2);
  }
  return 0;
}

function toValue(value: number, offset: number): SceneSpawnPointCoord {
  if (offset === 0) {
    return { $case: 'single', value };
  }
  return { $case: 'range', value: [round2(value - offset), round2(value + offset)] };
}

export const SPAWN_AREA_DEFAULTS = {
  position: { x: 2, y: 0, z: 2 },
  cameraTarget: { x: 8, y: 1, z: 8 },
  maxOffset: 2,
} as const;

export function fromSceneSpawnPoint(spawnPoint: SceneSpawnPoint): SpawnPointInput {
  const axes = [
    spawnPoint.position.x.value,
    spawnPoint.position.y.value,
    spawnPoint.position.z.value,
  ];
  const randomOffset = axes.some(Array.isArray);
  return {
    name: spawnPoint.name,
    default: spawnPoint.default ?? false,
    position: {
      x: getValue(spawnPoint.position.x),
      y: getValue(spawnPoint.position.y),
      z: getValue(spawnPoint.position.z),
    },
    randomOffset,
    maxOffset: randomOffset
      ? axes.reduce<number>((offset, axis) => Math.max(offset, getOffset(axis)), 0)
      : 0,
    cameraTarget: spawnPoint.cameraTarget || { ...SPAWN_AREA_DEFAULTS.cameraTarget },
  };
}

export function toSceneSpawnPoint(spawnPointInput: SpawnPointInput): SceneSpawnPoint {
  const offset = spawnPointInput.randomOffset ? spawnPointInput.maxOffset : 0;
  return {
    name: spawnPointInput.name,
    default: spawnPointInput.default,
    position: {
      x: toValue(spawnPointInput.position.x, offset),
      y: toValue(spawnPointInput.position.y, 0),
      z: toValue(spawnPointInput.position.z, offset),
    },
    cameraTarget: spawnPointInput.cameraTarget,
  };
}

export function isValidSpawnAreaName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export function isSpawnAreaInBounds(
  layout: Layout,
  position: { x: number; y: number; z: number },
  maxOffset: number,
): boolean {
  const corners = [
    new Vector3(position.x - maxOffset, position.y, position.z - maxOffset),
    new Vector3(position.x + maxOffset, position.y, position.z - maxOffset),
    new Vector3(position.x - maxOffset, position.y, position.z + maxOffset),
    new Vector3(position.x + maxOffset, position.y, position.z + maxOffset),
  ];
  return corners.every(corner => inBounds(layout, corner));
}

export function isPositionInBounds(
  layout: Layout,
  position: { x: number; y: number; z: number },
): boolean {
  return inBounds(layout, new Vector3(position.x, position.y, position.z));
}

export function generateSpawnAreaName(existingNames: string[]): string {
  let counter = 1;
  while (existingNames.includes(`SpawnArea${counter}`)) {
    counter++;
  }
  return `SpawnArea${counter}`;
}

export function generateDuplicateName(sourceName: string, existingNames: string[]): string {
  const match = sourceName.match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : sourceName;
  const startCounter = match ? parseInt(match[2], 10) + 1 : 2;

  let counter = startCounter;
  while (existingNames.includes(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}
