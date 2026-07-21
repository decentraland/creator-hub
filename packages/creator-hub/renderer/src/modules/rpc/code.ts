import { RPC, type Transport } from '@dcl/mini-rpc';

import type { OxcParseResult } from '/shared/types/oxc';

import { oxc } from '#preload';

export enum Method {
  PARSE = 'parse',
}

export type Params = {
  [Method.PARSE]: { filename: string; source: string };
};

export type Result = {
  [Method.PARSE]: OxcParseResult;
};

// Renderer-side server for the CodeParser channel. Answers the inspector
// iframe's parse requests by delegating to the main-process oxc-parser via
// the preload bridge. Shares the iframe MessageTransport with StorageRPC.
export class CodeParserRPC extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('CodeParser', transport);
    this.handle('parse', ({ filename, source }) => oxc.parse(filename, source));
  }
}
