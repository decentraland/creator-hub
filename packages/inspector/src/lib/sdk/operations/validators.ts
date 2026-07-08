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
const FIELD_PATH = /^[A-Za-z0-9_:-]+\.[A-Za-z0-9_.]+$/;

// Author-controlled node/root NAMES (core-schema::Name.value, asset-packs::UI.name)
// are less strict than variable identifiers — they are human labels that may
// contain spaces ("My Button") — so they can't reuse `isValidIdentifier`. But
// they still flow into generated TypeScript (the `UiEntityNames` enum keys via
// `toSafeIdentifier`, and `Name.value` via `engine.getEntityByName`), which
// CLAUDE.md flags as a code-injection / build-break vector. Strip the
// injection-capable characters (quotes, backticks, `${`, newlines, backslashes,
// …) at the write boundary as defense-in-depth alongside the codegen escaping
// pass, keeping only alphanumerics, underscore, dollar, and spaces.
const NODE_NAME_DISALLOWED = /[^A-Za-z0-9_$ ]/g;

export function sanitizeNodeName(s: string): string {
  return s.replace(NODE_NAME_DISALLOWED, '');
}

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
