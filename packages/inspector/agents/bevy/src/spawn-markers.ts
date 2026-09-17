/**
 * Shared registry mapping a spawn MARKER entity id (the avatar / camera-target
 * meshes drawn by spawn-areas.ts) → which spawn point/target it represents. Kept
 * in its own module so the gizmo's pick handler can consult it WITHOUT importing
 * spawn-areas.ts (which imports the gizmo for the scene offset — a cycle).
 */

export type SpawnMarkerTarget = { index: number; target: 'position' | 'cameraTarget' };

const markerToSpawn = new Map<number, SpawnMarkerTarget>();

export function registerSpawnMarker(entityId: number, target: SpawnMarkerTarget): void {
  markerToSpawn.set(entityId, target);
}

export function clearSpawnMarkers(): void {
  markerToSpawn.clear();
}

/** Which spawn point/target a picked entity represents, or null if it isn't a
 * spawn marker (the pick handler then falls through to normal entity picking). */
export function getSpawnMarkerTarget(entityId: number): SpawnMarkerTarget | null {
  return markerToSpawn.get(entityId) ?? null;
}
