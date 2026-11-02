const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const FIELD_PATH = /^[A-Za-z0-9_:-]+\.[A-Za-z0-9_.]+$/;

export function isValidIdentifier(s: string): boolean {
  return IDENTIFIER.test(s);
}

export function isValidFieldPath(s: string): boolean {
  return FIELD_PATH.test(s);
}

export function assertIdentifier(s: string, label = 'identifier'): void {
  if (!isValidIdentifier(s)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(s)}`);
  }
}

export function assertFieldPath(s: string, label = 'field path'): void {
  if (!isValidFieldPath(s)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(s)}`);
  }
}
