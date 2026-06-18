import type { Entity } from '@dcl/ecs';

type UiCallback = (...args: unknown[]) => unknown;

const uiContextValues = new Map<Entity, Record<string, unknown>>();
const uiCallbacks = new Map<Entity, Map<string, UiCallback>>();

/**
 * Push values for variables declared on a UI's marker. Call from scene code
 * to drive bound fields at runtime.
 *
 * @example
 *   const hud = engine.getEntityOrNullByName(UiEntityNames.MainHUD)!;
 *   setUiContext(hud, { score: 10, playerName: 'Alice' });
 *   setUiContext(hud, 'score', 11);
 */
export function setUiContext(uiRoot: Entity, patch: Record<string, unknown>): void;
export function setUiContext(uiRoot: Entity, name: string, value: unknown): void;
export function setUiContext(
  uiRoot: Entity,
  patchOrName: Record<string, unknown> | string,
  value?: unknown,
): void {
  let current = uiContextValues.get(uiRoot);
  if (!current) {
    current = Object.create(null) as Record<string, unknown>;
    uiContextValues.set(uiRoot, current);
  }
  if (typeof patchOrName === 'string') {
    current[patchOrName] = value;
    return;
  }
  for (const k in patchOrName) {
    if (Object.prototype.hasOwnProperty.call(patchOrName, k)) {
      current[k] = patchOrName[k];
    }
  }
}

/** Drop all pushed values for a UI. The renderer falls back to declared defaults / static field values. */
export function clearUiContext(uiRoot: Entity): void {
  uiContextValues.delete(uiRoot);
}

/**
 * Register a callback for a variable of type `callback` on a UI's marker.
 *
 * @example
 *   const hud = engine.getEntityOrNullByName(UiEntityNames.MainHUD)!;
 *   setUiCallback(hud, 'onScoreClick', () => console.log('clicked'));
 */
export function setUiCallback(uiRoot: Entity, name: string, fn: UiCallback): void {
  const map = uiCallbacks.get(uiRoot) ?? new Map<string, UiCallback>();
  map.set(name, fn);
  uiCallbacks.set(uiRoot, map);
}

/** Clear a single registered callback (e.g. on unmount). */
export function clearUiCallback(uiRoot: Entity, name: string): void {
  const map = uiCallbacks.get(uiRoot);
  if (!map) return;
  map.delete(name);
}

/** Drop every registered callback for a UI (e.g. when its root entity is removed). */
export function clearUiCallbacks(uiRoot: Entity): void {
  uiCallbacks.delete(uiRoot);
}

// --- Internal read accessors used by ui-runtime.ts ---

/** @internal */
export function getUiContextValue(uiRoot: Entity, name: string): unknown {
  return uiContextValues.get(uiRoot)?.[name];
}

/** @internal */
export function getUiCallback(uiRoot: Entity, name: string): UiCallback | undefined {
  return uiCallbacks.get(uiRoot)?.get(name);
}
