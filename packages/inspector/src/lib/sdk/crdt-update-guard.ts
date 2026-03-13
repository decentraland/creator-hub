/**
 * Tracks which engines should skip CRDT updates (engine.update calls from
 * incoming data-layer messages).  Used during gizmo drag to prevent
 * intermediate round-trips that create unwanted undo entries.
 *
 * A WeakSet is used so entries are automatically cleaned up if the engine
 * is garbage-collected, and we avoid mutating frozen engine objects.
 */
const suppressedEngines = new WeakSet<object>();

export function suppressCrdtUpdates(engine: object) {
  suppressedEngines.add(engine);
}

export function resumeCrdtUpdates(engine: object) {
  suppressedEngines.delete(engine);
}

export function isCrdtUpdateSuppressed(engine: object): boolean {
  return suppressedEngines.has(engine);
}
