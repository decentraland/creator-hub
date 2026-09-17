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
