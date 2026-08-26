// Validation helpers for user-controlled strings that flow into generated
// TypeScript source (UI Designer variable/prop/callback names, field paths).
// Centralized here so every consumer gates on the same regex and so a single
// edit can tighten the rules for all consumers at once.
//
// Why these regexes:
// - IDENTIFIER is the JS identifier rule. The UI Designer splices the
//   resulting string directly into .tsx source; anything outside this charset
//   is a code-injection vector.
// - FIELD_PATH allows `componentId.fieldPath` shapes such as
//   `core::UiText.value` or `ui::events.onMouseDown`. The `::` between
//   namespace and component is intentional; everything else is alnum or `_`.

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
