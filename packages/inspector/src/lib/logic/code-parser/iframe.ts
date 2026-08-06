import type { Transport } from '@dcl/mini-rpc';
import { RPC, MessageTransport } from '@dcl/mini-rpc';

import type { OxcParseResult } from './types';

// Inspector-side client for the CodeParser channel. The native oxc-parser
// cannot run in this browser iframe, so parsing is delegated to the Creator
// Hub main process over RPC (iframe → renderer → preload → main). Mirrors the
// IframeStorage client pattern.

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

// Create the parser client bound to the parent (Creator Hub renderer) origin.
// Called once during data-layer connection, alongside the storage/scene RPCs.
export function createIframeCodeParser(origin: string): Client {
  if (!window.parent) {
    throw new Error('The code parser requires the inspector to run inside an iframe');
  }
  const transport = new MessageTransport(window, window.parent, origin);
  instance = new Client(transport);
  return instance;
}

// The parser client, or undefined when running standalone (no Creator Hub
// parent / main process). See `getCodeParser` for the dev-build fallback.
export function getIframeCodeParser(): Client | undefined {
  return instance;
}
