import { MessageTransport } from '@dcl/mini-rpc';

import { CameraRPC } from './camera';

import { fs } from '#preload';
import { type Project } from '/shared/types/projects';
import { UiRPC } from './ui';
import { type Method, type Params, type Result, StorageRPC } from './storage';

export type CallbackParams = {
  iframe: HTMLIFrameElement;
  project: Project;
  storage: StorageRPC;
  camera: CameraRPC;
};

interface Callbacks {
  writeFile?: (
    cbParams: CallbackParams,
    fnParams: Params[Method.WRITE_FILE],
  ) => Promise<Result[Method.WRITE_FILE]>;
}

export function initRpc(iframe: HTMLIFrameElement, project: Project, cbs: Partial<Callbacks> = {}) {
  const transport = new MessageTransport(window, iframe.contentWindow!);
  const camera = new CameraRPC(transport);
  const ui = new UiRPC(transport);
  const storage = new StorageRPC(transport);
  const params = { iframe, project, storage, camera };

  storage.handle('read_file', async ({ path }) => {
    const file = await fs.readFile(await fs.resolve(project.path, path));
    return file;
  });
  storage.handle('write_file', async ({ path, content }) => {
    await fs.writeFile(await fs.resolve(project.path, path), content as any); // "content as any" since there is a mismatch in typescript's type definitions
    await cbs.writeFile?.(params, { path, content });
  });
  storage.handle('exists', async ({ path }) => {
    return await fs.exists(await fs.resolve(project.path, path));
  });
  storage.handle('delete', async ({ path }) => {
    await fs.rm(await fs.resolve(project.path, path));
  });
  storage.handle('list', async ({ path }) => {
    const projectPath = await fs.resolve(project.path, path);
    const files = await fs.readdir(projectPath);
    const list = [];
    for (const file of files) {
      const filePath = await fs.resolve(projectPath, file);
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
    dispose: () => {
      storage.dispose();
    },
  };
}