import init, { parseSync } from '@oxc-parser/wasm/web/oxc_parser_wasm.js';

import wasmBytes from '@oxc-parser/wasm/web/oxc_parser_wasm_bg.wasm';

import type { CodeParser } from './types';

let ready: Promise<unknown> | undefined;

export const wasmCodeParser: CodeParser = {
  async parse(filename, source) {
    ready ??= init({ module_or_path: wasmBytes }).catch(e => {
      ready = undefined;
      throw e;
    });
    await ready;
    const result = parseSync(source, { sourceFilename: filename });
    try {
      return { program: result.program, comments: result.comments, errors: result.errors };
    } finally {
      result.free();
    }
  },
};
