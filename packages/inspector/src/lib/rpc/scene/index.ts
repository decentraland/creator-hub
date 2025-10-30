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

  const transport = new MessageTransport(window, window.parent, origin);
  const client = new SceneClient(transport);
  sceneClientInstance = client;
}
