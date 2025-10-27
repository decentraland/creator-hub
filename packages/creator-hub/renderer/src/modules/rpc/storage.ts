import { RPC, type Transport } from '@dcl/mini-rpc';

export enum Method {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  EXISTS = 'exists',
  DELETE = 'delete',
  LIST = 'list',
  OPEN_FILE = 'open_file',
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
  [Method.OPEN_FILE]: {
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
  [Method.OPEN_FILE]: void;
};

export class StorageRPC extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('IframeStorage', transport);
  }
}
