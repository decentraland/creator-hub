import { parseSync } from 'oxc-parser';

import type { OxcParseResult } from '/shared/types/oxc';

/** Parse a TSX/TS source into an ESTree AST using the native oxc-parser. */
export async function parse(filename: string, source: string): Promise<OxcParseResult> {
  const result = parseSync(filename, source);
  return {
    program: result.program,
    comments: result.comments as unknown as OxcParseResult['comments'],
    errors: result.errors as unknown[],
  };
}
