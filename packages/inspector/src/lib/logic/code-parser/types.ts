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

/** A parser producing an ESTree program whose node spans are byte offsets into `source`, for splice editing. */
export interface CodeParser {
  parse(filename: string, source: string): Promise<OxcParseResult>;
}
