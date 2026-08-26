import { parseSync } from 'oxc-parser';

import type { OxcParseResult } from '/shared/types/oxc';

// Parse a TSX/TS source into an ESTree AST using the native oxc-parser.
// Runs in the Electron main (Node) process — the native binding can't load in
// the inspector's browser iframe — and is reached over the CodeParser RPC.
// Every AST node carries `start`/`end` byte offsets by default, which the
// inspector's emit adapter uses to splice edits into the exact source region.
export async function parse(filename: string, source: string): Promise<OxcParseResult> {
  const result = parseSync(filename, source);
  // `.program` is a lazily-deserialized plain-object AST (structured-cloneable
  // across IPC); comments/errors are plain arrays. We do not return
  // `magicString` (a class instance) — the inspector splices text itself.
  return {
    program: result.program,
    comments: result.comments as unknown as OxcParseResult['comments'],
    errors: result.errors as unknown[],
  };
}
