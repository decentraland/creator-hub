import { format } from 'prettier/standalone';
import * as estreePlugin from 'prettier/plugins/estree';
import * as typescriptPlugin from 'prettier/plugins/typescript';

// Whole-file formatting for the UI source files. Span splices deliberately
// never reflow anything, so editor churn (moves, removals, inserted siblings)
// accumulates blank lines and stale indentation — after each successful splice
// the store runs the buffer through Prettier (the pure-JS standalone build, so
// it works in the iframe with no Electron RPC) and reparses. Only EDITOR writes
// are formatted; files read from disk (external edits) are never reformatted.
//
// Style matches the code the editor itself generates (aggregator/templates):
// no semicolons, single quotes — the @dcl/sdk scene-template style.
const OPTIONS = {
  parser: 'typescript' as const,
  plugins: [typescriptPlugin, estreePlugin],
  printWidth: 100,
  semi: false,
  singleQuote: true,
  trailingComma: 'all' as const,
  arrowParens: 'avoid' as const,
};

// Returns the formatted source, or the input unchanged when it can't be
// formatted (a syntax error — loadAndParse surfaces that separately).
export async function formatUiSource(source: string): Promise<string> {
  try {
    return await format(source, OPTIONS);
  } catch {
    return source;
  }
}
