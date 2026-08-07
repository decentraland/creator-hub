// Result of parsing a TSX/TS source with oxc-parser in the main process.
// Kept intentionally loose: `program` is the ESTree AST (walked by the
// inspector's code-mode adapters) and travels over IPC as plain JSON.
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
