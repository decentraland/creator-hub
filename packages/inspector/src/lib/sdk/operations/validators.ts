// Validation helpers for SDK operations that write user-controlled strings
// into the CRDT. Centralized here so every operation gates on the same regex
// and so a single edit can tighten the rules for all consumers at once.
//
// Why these regexes:
// - IDENTIFIER mirrors the JS identifier rule used by `VALID_IDENTIFIER` in
//   `components/UIDesigner/VariablesPanel/VariablesPanel.tsx`. The codegen at
//   `engine-to-composite.ts` interpolates the resulting string directly into
//   TypeScript source; anything outside this charset is a code-injection
//   vector.
// - FIELD_PATH allows `componentId.fieldPath` shapes such as
//   `core::UiText.value` or `asset-packs::UI.onMouseDown`. The `::` between
//   namespace and component is intentional; everything else is alnum or `_`.

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const FIELD_PATH = /^[A-Za-z0-9_:]+\.[A-Za-z0-9_.]+$/;

export function isValidIdentifier(s: string): boolean {
  return typeof s === 'string' && IDENTIFIER.test(s);
}

export function isValidFieldPath(s: string): boolean {
  return typeof s === 'string' && FIELD_PATH.test(s);
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
