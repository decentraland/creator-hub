import { RPC, type Transport } from '@dcl/mini-rpc';

export enum Method {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  EXISTS = 'exists',
  DELETE = 'delete',
  LIST = 'list',
  UI_REQUEST = 'ui_request',
}

export type UIRequest =
  | { action: 'open_file'; path: string }
  | { action: 'open_directory'; path: string };

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
  [Method.UI_REQUEST]: UIRequest;
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
  [Method.UI_REQUEST]: void;
};

export class StorageRPC extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('IframeStorage', transport);
  }
}
