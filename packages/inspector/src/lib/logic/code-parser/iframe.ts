import type { Transport } from '@dcl/mini-rpc';
import { RPC, MessageTransport } from '@dcl/mini-rpc';

// Inspector-side client for the CodeParser channel. The native oxc-parser
// cannot run in this browser iframe, so parsing is delegated to the Creator
// Hub main process over RPC (iframe → renderer → preload → main). Mirrors the
// IframeStorage client pattern.

export interface OxcComment {
  type: string;
  value: string;
  start: number;
  end: number;
}

export interface OxcParseResult {
  program: unknown;
  comments: OxcComment[];
  errors: unknown[];
}

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

// Access the parser client, or undefined when running standalone (no Creator
// Hub parent / main process) — code-mode is Electron-only for now.
export function getCodeParser(): Client | undefined {
  return instance;
}
