import { MessageTransport } from '@dcl/mini-rpc';

import { type Project } from '/shared/types/projects';

import { fs, custom } from '#preload';

import { SceneRpcClient } from './scene/client';
import { SceneRpcServer } from './scene/server';
import { type Method, type Params, type Result, StorageRPC } from './storage';

export type RPCInfo = {
  iframe: HTMLIFrameElement;
  project: Project;
  scene: SceneRpcClient;
};

export interface Callbacks {
  writeFile?: (
    rpcInfo: RPCInfo,
    fnParams: Params[Method.WRITE_FILE],
  ) => Promise<Result[Method.WRITE_FILE]>;
}

export const getPath = async (filePath: string, project: Project) => {
  let basePath = project.path;
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath === 'custom' || normalizedPath.startsWith('custom/')) {
    basePath = await custom.getPath();
    filePath =
      normalizedPath === 'custom' ? '' : normalizedPath.substring(normalizedPath.indexOf('/') + 1);
  }
  const resolvedPath = await fs.resolve(basePath, filePath);
  return resolvedPath;
};

export function initRpc(iframe: HTMLIFrameElement, project: Project, cbs: Partial<Callbacks> = {}) {
  const transport = new MessageTransport(window, iframe.contentWindow!);
  const sceneClient = new SceneRpcClient(transport);
  const _sceneServer = new SceneRpcServer(transport, project);
  const params = { iframe, project, scene: sceneClient };
  const storage = new StorageRPC(transport, cbs, params);

  void Promise.all([
    sceneClient.selectAssetsTab('AssetsPack'),
    sceneClient.selectSceneInspectorTab('details'),
  ]).catch(console.error);

  return {
    ...params,
    dispose: () => {
      storage.dispose();
    },
  };
}

export async function takeScreenshot(iframe: HTMLIFrameElement, sceneRPC?: SceneRpcClient) {
  // TODO:
  // 1. make the camera position/target relative to parcels rows & columns
  // 2. the SceneServer only allows to reposition the main camera, so repositioning it, will also
  //    reposition the content creator's view. We need a way to specify a different camera or a way to
  //    save the current position, move it for a screenshot, and restore it
  //
  // leaving the next line just for reference:
  // await Promise.all([camera.setPosition(x, y, z), camera.setTarget(x, y, z)]);
  const _sceneRPC =
    sceneRPC ?? new SceneRpcClient(new MessageTransport(window, iframe.contentWindow!));
  const screenshot = await _sceneRPC.takeScreenshot(+iframe.width, +iframe.height);
  return screenshot;
}
