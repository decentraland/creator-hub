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
 * Genesis City: mirrors the places service (`processContentEntityScene` / `findSamePlace`). The
 * deployment updates the overlapped place with the same base parcel, or else the one with the
 * same set of parcels; every other place on the target parcels is disabled. So a scene keeps its
 * Place unless the deployment changes BOTH its base parcel AND its set of parcels, and if any of
 * the replaced scenes loses its Place the deployment breaks continuity. A parcel with no scene
 * yet has no Place to lose.
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
 * Why a world deployment registers a new place while existing listings are disabled:
 * - `merge`: it overlaps two or more scenes, which all lose their listings.
 * - `replace-world`: single-scene mode undeploys the whole world first (the Deploy step's
 *   `needsUndeploy`), which disables every listing in it.
 *
 * Mirrors the places service (`resolveWorldDeployment`): a deployment overlapping exactly one
 * active place updates it; otherwise it creates a new place and disables the overlapped ones. An
 * undeployed world's places are disabled, so emptying the world first leaves nothing to update.
 * In multi-scene mode a placement overlapping nothing is a new scene that disables nothing, so it
 * does not warn.
 */
export type WorldPlaceContinuityBreak = 'merge' | 'replace-world';

export function getWorldPlaceContinuityBreak(
  worldScenes: { parcels?: string[] }[],
  parcels: string[],
  isMultiScene: boolean,
): WorldPlaceContinuityBreak | null {
  if (worldScenes.length === 0) return null;
  const overlap = countOverlappedWorldScenes(worldScenes, parcels);
  if (overlap >= 2) return 'merge';
  if (!isMultiScene && overlap < worldScenes.length) return 'replace-world';
  return null;
}
