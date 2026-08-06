import init, { parseSync } from '@oxc-parser/wasm/web/oxc_parser_wasm.js';

import wasmBytes from '@oxc-parser/wasm/web/oxc_parser_wasm_bg.wasm';

import type { CodeParser } from './types';

// Dev-only in-browser parser, so the standalone inspector (:8000) can run
// code-mode with no Creator Hub main process behind it.
//
// `@oxc-parser/wasm` is pinned to the same oxc version as CH's native
// `oxc-parser` and emits a byte-identical AST — asserted in wasm.spec.ts,
// because the splice engine edits by span and any offset drift would corrupt
// scene files.
//
// Only ever reached through a dynamic import inside an `INSPECTOR_DEV_PARSER`
// branch (see ./index.ts), which is how the ~740KB wasm stays out of the
// production bundle.

let ready: Promise<unknown> | undefined;

export const wasmCodeParser: CodeParser = {
  async parse(filename, source) {
    ready ??= init({ module_or_path: wasmBytes });
    await ready;
    const result = parseSync(source, { sourceFilename: filename });
    try {
      return { program: result.program, comments: result.comments, errors: result.errors };
    } finally {
      // The result owns wasm memory until freed; its getters return detached
      // JS values, so the returned AST outlives it.
      result.free();
    }
  },
};
