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
