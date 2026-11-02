import { MessageTransport } from '@dcl/mini-rpc';
import { SceneClient } from './client';

let sceneClientInstance: SceneClient | undefined;

export function getSceneClient(): SceneClient | undefined {
  return sceneClientInstance;
}

export function createIframeScene(origin: string) {
  if (!window.parent) {
    throw new Error('To use this ui the webapp needs to be inside an iframe');
  }
  // Idempotent: the scene-RPC client is a singleton. It's set up from the
  // parent-window data-layer path AND (for renderers whose data-layer is a WS,
  // like Bevy) from the SDK context when only `dataLayerRpcParentUrl` is present —
  // both may run, so don't rebuild the transport/client if it already exists.
  if (sceneClientInstance) return;

  const transport = new MessageTransport(window, window.parent, origin);
  const client = new SceneClient(transport);
  sceneClientInstance = client;
}
