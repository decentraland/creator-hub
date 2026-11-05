import type { SceneRpcClient } from './scene/client';

/**
 * The scene RPC channel of the Inspector iframe currently on screen, or `null` when no editor
 * is open. Flows that must talk to the open editor — publishing has to flush its pending
 * writes first — run in thunks that never see the iframe, so the channel is held here.
 *
 * Deliberately a leaf module: `modules/rpc` reaches the redux store through the scene RPC
 * server, so a store slice importing it directly would close an import cycle and leave the
 * slice's own action creators undefined at evaluation time.
 */
let activeSceneClient: SceneRpcClient | null = null;

export function setActiveSceneClient(client: SceneRpcClient | null): void {
  activeSceneClient = client;
}

export function clearActiveSceneClient(client: SceneRpcClient): void {
  if (activeSceneClient === client) activeSceneClient = null;
}

export function getActiveSceneClient(): SceneRpcClient | null {
  return activeSceneClient;
}

const readyWaiters = new Set<() => void>();

/**
 * The open editor's scene RPC server came up: on first load, and again whenever the
 * inspector iframe reloads itself in place (under Bevy an edit can do that).
 */
export function notifyActiveSceneReady(client: SceneRpcClient): void {
  if (activeSceneClient !== client) return;
  const waiters = [...readyWaiters];
  readyWaiters.clear();
  for (const resolve of waiters) resolve();
}

export type ReadyWait = {
  /** Resolves on the next ready signal; never settles if cancelled first. */
  ready: Promise<void>;
  /** Stops waiting, so a later ready signal finds nothing of this caller's. */
  cancel: () => void;
};

/** Waits for the next ready signal of the open editor, until cancelled. */
export function waitForActiveSceneReady(): ReadyWait {
  let onReady: () => void = () => undefined;
  const ready = new Promise<void>(resolve => {
    onReady = resolve;
  });
  readyWaiters.add(onReady);
  return { ready, cancel: () => readyWaiters.delete(onReady) };
}

/** How many callers are waiting for the editor to come up; for tests. */
export function pendingReadyWaiters(): number {
  return readyWaiters.size;
}
