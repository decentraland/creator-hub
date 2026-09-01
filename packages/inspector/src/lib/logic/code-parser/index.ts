import { getIframeCodeParser } from './iframe';
import type { CodeParser } from './types';

export * from './iframe';
export * from './types';

let fallback: CodeParser | undefined;

/** The parser for code-mode: the Creator Hub bridge, else a dev-only wasm fallback, else undefined. */
export function getCodeParser(): CodeParser | undefined {
  const bridge = getIframeCodeParser();
  if (bridge) return bridge;
  if (INSPECTOR_DEV_PARSER) {
    fallback ??= {
      parse: async (filename, source) => {
        const { wasmCodeParser } = await import('./wasm');
        return wasmCodeParser.parse(filename, source);
      },
    };
    return fallback;
  }
  return undefined;
}
