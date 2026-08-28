import type { Transport } from '@dcl/mini-rpc';
import { RPC, MessageTransport } from '@dcl/mini-rpc';

import type { OxcParseResult } from './types';

export enum Method {
  PARSE = 'parse',
}

export type Params = {
  [Method.PARSE]: { filename: string; source: string };
};

export type Result = {
  [Method.PARSE]: OxcParseResult;
};

export const id = 'CodeParser';

export class Client extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(id, transport);
  }

  parse(filename: string, source: string) {
    return this.request('parse', { filename, source });
  }
}

let instance: Client | undefined;

export function createIframeCodeParser(origin: string): Client {
  if (!window.parent) {
    throw new Error('The code parser requires the inspector to run inside an iframe');
  }
  const transport = new MessageTransport(window, window.parent, origin);
  instance = new Client(transport);
  return instance;
}

export function getIframeCodeParser(): Client | undefined {
  return instance;
}
