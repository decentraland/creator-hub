import { format } from 'prettier/standalone';
import * as estreePlugin from 'prettier/plugins/estree';
import * as typescriptPlugin from 'prettier/plugins/typescript';

const OPTIONS = {
  parser: 'typescript' as const,
  plugins: [typescriptPlugin, estreePlugin],
  printWidth: 100,
  semi: false,
  singleQuote: true,
  trailingComma: 'all' as const,
  arrowParens: 'avoid' as const,
};

/** Returns the formatted source, or the input unchanged when it can't be formatted (a syntax error). */
export async function formatUiSource(source: string): Promise<string> {
  try {
    return await format(source, OPTIONS);
  } catch {
    return source;
  }
}
