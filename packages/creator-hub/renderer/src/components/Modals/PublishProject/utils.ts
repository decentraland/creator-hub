import type { Project } from '/shared/types/projects';
import type { Coordinate } from './types';

export function parseCoords(coords: string) {
  return coords.split(',').map(coord => parseInt(coord, 10)) as [number, number];
}

export function calculateParcels(project: Project, point: Coordinate): Coordinate[] {
  const [baseX, baseY] = parseCoords(project.scene.base);
  return project.scene.parcels.map(parcel => {
    const [x, y] = parseCoords(parcel);
    return { x: x - baseX + point.x, y: y - baseY + point.y };
  });
}

type SceneShape = { base: string; parcels: string[] };

const sameSet = (a: string[], b: string[]) => {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every(parcel => setB.has(parcel));
};

/**
 * Genesis City: the Place of a scene survives a redeployment unless it changes BOTH its base
 * parcel AND its set of occupied parcels (AND logic). A parcel with no scene yet has no
 * Place to lose, so `existing` being empty never breaks continuity.
 *
 * Every scene replaced by the new deployment counts: if any of them loses its Place, the
 * deployment breaks continuity.
 */
export function breaksLandPlaceContinuity(existing: SceneShape[], next: SceneShape): boolean {
  return existing.some(scene => scene.base !== next.base && !sameSet(scene.parcels, next.parcels));
}

/** How many of the world's current scenes the new parcels overlap. */
export function countOverlappedWorldScenes(
  worldScenes: { parcels?: string[] }[],
  parcels: string[],
): number {
  const next = new Set(parcels);
  return worldScenes.filter(scene => (scene.parcels ?? []).some(parcel => next.has(parcel))).length;
}

/**
 * Worlds: a redeployment keeps the Place only when it overlaps exactly one existing scene.
 * Overlapping none (a new scene) or two or more (a merge) breaks continuity. A world with no
 * scenes yet has no Place to lose.
 */
export function breaksWorldPlaceContinuity(
  worldScenes: { parcels?: string[] }[],
  parcels: string[],
): boolean {
  if (worldScenes.length === 0) return false;
  return countOverlappedWorldScenes(worldScenes, parcels) !== 1;
}
