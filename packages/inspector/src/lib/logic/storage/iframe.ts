import type { Transport } from '@dcl/mini-rpc';
import { RPC, MessageTransport } from '@dcl/mini-rpc';
import type { Storage } from './types';

export enum Method {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  EXISTS = 'exists',
  DELETE = 'delete',
  RMDIR = 'rmdir',
  LIST = 'list',
  STAT = 'stat',
}

export type Params = {
  [Method.READ_FILE]: { path: string };
  [Method.WRITE_FILE]: { path: string; content: Buffer };
  [Method.DELETE]: { path: string };
  [Method.RMDIR]: { path: string };
  [Method.EXISTS]: { path: string };
  [Method.LIST]: { path: string };
  [Method.STAT]: { path: string };
};

export type Result = {
  [Method.READ_FILE]: Buffer;
  [Method.WRITE_FILE]: void;
  [Method.DELETE]: void;
  [Method.RMDIR]: void;
  [Method.EXISTS]: boolean;
  [Method.LIST]: { name: string; isDirectory: boolean }[];
  [Method.STAT]: { size: number };
};

export const id = 'IframeStorage';

export class Client extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(id, transport);
  }

  readFile(path: string) {
    return this.request('read_file', { path });
  }

  writeFile(path: string, content: Buffer) {
    return this.request('write_file', { path, content });
  }

  exists(path: string) {
    return this.request('exists', { path });
  }

  delete(path: string) {
    return this.request('delete', { path });
  }

  rmdir(path: string) {
    return this.request('rmdir', { path });
  }

  list(path: string) {
    return this.request('list', { path });
  }

  stat(path: string) {
    return this.request('stat', { path });
  }
}

export class Server extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(id, transport);
  }
}

export function createIframeStorage(origin: string): Storage {
  if (!window.parent) {
    throw new Error('To use this storage the webapp needs to be inside an iframe');
  }

  const transport = new MessageTransport(window, window.parent, origin);
  const client = new Client(transport);

  return client;
}
