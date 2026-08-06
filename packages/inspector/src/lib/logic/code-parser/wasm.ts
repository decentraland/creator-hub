import init, { parseSync } from '@oxc-parser/wasm/web/oxc_parser_wasm.js';

import wasmBytes from '@oxc-parser/wasm/web/oxc_parser_wasm_bg.wasm';

import type { CodeParser } from './types';

// Dev-only in-browser parser, so the standalone inspector (:8000) can run
// code-mode with no Creator Hub main process behind it.
//
// `@oxc-parser/wasm` must emit a byte-identical AST to CH's native `oxc-parser`,
// because the splice engine edits by span and any offset drift would corrupt scene
// files. Matching `^0.60.0` ranges is NOT that guarantee — the two are declared in
// separate manifests and can resolve to different patches — so wasm.spec.ts asserting
// the two ASTs are equal is the real guard.
//
// Only ever reached through a dynamic import inside an `INSPECTOR_DEV_PARSER`
// branch (see ./index.ts), which is how the ~740KB wasm stays out of the
// production bundle.

let ready: Promise<unknown> | undefined;

export const wasmCodeParser: CodeParser = {
  async parse(filename, source) {
    // Drop a rejected init so the next parse retries: a cached rejection would
    // disable the parser for the lifetime of the tab over one failed fetch.
    ready ??= init({ module_or_path: wasmBytes }).catch(e => {
      ready = undefined;
      throw e;
    });
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
