import { MessageTransport, RPC } from '@dcl/mini-rpc';

import { fs } from '#preload';
import { type Project } from '/shared/types/projects';

export enum Method {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  EXISTS = 'exists',
  DELETE = 'delete',
  LIST = 'list',
}

export type Params = {
  [Method.READ_FILE]: {
    path: string;
  };
  [Method.WRITE_FILE]: {
    path: string;
    content: Buffer;
  };
  [Method.DELETE]: {
    path: string;
  };
  [Method.EXISTS]: {
    path: string;
  };
  [Method.LIST]: {
    path: string;
  };
};

export type Result = {
  [Method.READ_FILE]: Buffer;
  [Method.WRITE_FILE]: void;
  [Method.DELETE]: void;
  [Method.EXISTS]: boolean;
  [Method.LIST]: {
    name: string;
    isDirectory: boolean;
  }[];
};

interface Callbacks {
  writeFile?: (params: Params[Method.WRITE_FILE]) => Result[Method.WRITE_FILE];
}

export function initTransport(
  target: HTMLIFrameElement,
  project: Project,
  cbs: Partial<Callbacks> = {},
) {
  const transport = new MessageTransport(window, target.contentWindow!);
  const storage = new RPC<Method, Params, Result>('IframeStorage', transport);
  storage.handle('read_file', async ({ path }) => {
    const file = await fs.readFile(await fs.resolve(project.path, path));
    return file;
  });
  storage.handle('write_file', async ({ path, content }) => {
    await fs.writeFile(await fs.resolve(project.path, path), content);
    cbs.writeFile?.({ path, content });
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

  return {
    dispose: () => storage.dispose(),
  };
}
