import type { IEngine } from '@dcl/ecs';
/**
 * Tracks which engines should skip CRDT updates (engine.update calls from
 * incoming data-layer messages).  Used during gizmo drag to prevent
 * intermediate round-trips that create unwanted undo entries.
 *
 * A WeakSet is used so entries are automatically cleaned up if the engine
 * is garbage-collected, and we avoid mutating frozen engine objects.
 */
const suppressedEngines = new WeakSet<IEngine>();

export function suppressCrdtUpdates(engine: IEngine) {
  suppressedEngines.add(engine);
}

export function resumeCrdtUpdates(engine: IEngine) {
  suppressedEngines.delete(engine);
}

export function isCrdtUpdateSuppressed(engine: IEngine): boolean {
  return suppressedEngines.has(engine);
}
