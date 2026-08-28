import type { OxcParseResult } from '/shared/types/oxc';

import { invoke } from '../services/ipc';

/** Forwards a parse request from the renderer to the main-process oxc-parser. */
export async function parse(filename: string, source: string): Promise<OxcParseResult> {
  return invoke('oxc.parse', filename, source);
}
