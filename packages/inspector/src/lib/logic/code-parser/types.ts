export interface OxcComment {
  type: string;
  value: string;
  start: number;
  end: number;
}

export interface OxcParseResult {
  program: unknown;
  comments: OxcComment[];
  errors: unknown[];
}

// What code-mode needs from a parser: an ESTree program whose node spans are
// offsets into `source` (the splice engine edits by byte span). Implemented by
// the CH-main RPC bridge (production) and by the dev-only wasm parser.
export interface CodeParser {
  parse(filename: string, source: string): Promise<OxcParseResult>;
}
