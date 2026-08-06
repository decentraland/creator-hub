import { getIframeCodeParser } from './iframe';
import type { CodeParser } from './types';

export * from './iframe';
export * from './types';

let fallback: CodeParser | undefined;

// The parser code-mode should use: the Creator Hub bridge when there is one,
// otherwise — in dev builds only — a wasm parser running in this tab, so the
// standalone inspector at :8000 can run code-mode too. A production build with
// no bridge has no parser at all (`INSPECTOR_DEV_PARSER` is false, so the
// dynamic import below is dead code esbuild drops along with the wasm).
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
