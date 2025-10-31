import { RPC, type Transport } from '@dcl/mini-rpc';

import { debounceByKey } from '/shared/utils';
import { fs } from '#preload';

import { type Callbacks, getPath, type RPCInfo } from './';

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

export class StorageRPC extends RPC<Method, Params, Result> {
  constructor(transport: Transport, cbs: Partial<Callbacks> = {}, params: RPCInfo) {
    super('IframeStorage', transport);

    // Common write function
    const writeFile = async ({ path, content }: Params[Method.WRITE_FILE]) => {
      await fs.writeFile(await getPath(path, params.project), content as any);
      await cbs.writeFile?.(params, { path, content });
    };

    // Create a debounced version of the write operation for crdt/composite files, separate for each file path
    const debouncedWrite = debounceByKey(writeFile, 1000, ({ path }) => path);

    this.handle('write_file', async writeParams => {
      // Check if the file is a .crdt or .composite file
      const isCrdtOrComposite =
        writeParams.path.endsWith('.crdt') || writeParams.path.endsWith('.composite');

      if (isCrdtOrComposite) {
        return debouncedWrite(writeParams);
      } else {
        await writeFile(writeParams);
      }
    });

    this.handle('read_file', async ({ path }) => {
      const file = await fs.readFile(await getPath(path, params.project));
      return file;
    });

    this.handle('exists', async ({ path }) => {
      return fs.exists(await getPath(path, params.project));
    });

    this.handle('delete', async ({ path }) => {
      await fs.rm(await getPath(path, params.project));
    });

    this.handle('list', async ({ path }) => {
      const basePath = await getPath(path, params.project);
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
  }
}
