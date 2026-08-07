import type { OxcParseResult } from '/shared/types/oxc';

import { invoke } from '../services/ipc';

// Preload bridge: forwards a parse request from the renderer to the main
// process, where the native oxc-parser lives.
export async function parse(filename: string, source: string): Promise<OxcParseResult> {
  return invoke('oxc.parse', filename, source);
}
