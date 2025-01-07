import { MessageTransport } from '@dcl/mini-rpc';

import { CameraRPC } from './camera';

import { fs, custom } from '#preload';

import { type Project } from '/shared/types/projects';

import { UiRPC } from './ui';
import { type Method, type Params, type Result, StorageRPC } from './storage';

export type RPCInfo = {
  iframe: HTMLIFrameElement;
  project: Project;
  storage: StorageRPC;
  camera: CameraRPC;
};

interface Callbacks {
  writeFile?: (
    rpcInfo: RPCInfo,
    fnParams: Params[Method.WRITE_FILE],
  ) => Promise<Result[Method.WRITE_FILE]>;
}

const getPath = async (filePath: string, project: Project) => {
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
  const camera = new CameraRPC(transport);
  const ui = new UiRPC(transport);
  const storage = new StorageRPC(transport);
  const params = { iframe, project, storage, camera };

  storage.handle('read_file', async ({ path }) => {
    const file = await fs.readFile(await getPath(path, project));
    return file;
  });
  storage.handle('write_file', async ({ path, content }) => {
    await fs.writeFile(await getPath(path, project), content as any); // "content as any" since there is a mismatch in typescript's type definitions
    await cbs.writeFile?.(params, { path, content });
  });
  storage.handle('exists', async ({ path }) => {
    return fs.exists(await getPath(path, project));
  });
  storage.handle('delete', async ({ path }) => {
    await fs.rm(await getPath(path, project));
  });
  storage.handle('list', async ({ path }) => {
    const basePath = await getPath(path, project);
    const files = await fs.readdir(basePath);
    const list = [];
    for (const file of files) {
      const filePath = await fs.resolve(basePath, file);
      list.push({
        name: file,
        isDirectory: await fs.isDirectory(filePath),
      });
    }

    return list;
  });

  void Promise.all([ui.selectAssetsTab('AssetsPack'), ui.selectSceneInspectorTab('details')]).catch(
    console.error,
  );

  return {
    ...params,
    dispose: () => {
      storage.dispose();
    },
  };
}

export async function takeScreenshot(iframe: HTMLIFrameElement, camera?: CameraRPC) {
  // TODO:
  // 1. make the camera position/target relative to parcels rows & columns
  // 2. the CameraServer only allows to reposition the main camera, so repositioning it, will also
  //    reposition the content creator's view. We need a way to specify a different camera or a way to
  //    save the current position, move it for a screenshot, and restore it
  //
  // leaving the next line just for reference:
  // await Promise.all([camera.setPosition(x, y, z), camera.setTarget(x, y, z)]);
  const _camera = camera ?? new CameraRPC(new MessageTransport(window, iframe.contentWindow!));
  const screenshot = await _camera.takeScreenshot(+iframe.width, +iframe.height);
  return screenshot;
}
