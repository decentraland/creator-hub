import { describe, it, expect } from 'vitest';

import {
  isValidFieldPath,
  isValidIdentifier,
  assertFieldPath,
  sanitizeNodeName,
} from './validators';

describe('isValidFieldPath', () => {
  it('accepts core component field paths', () => {
    expect(isValidFieldPath('core::UiText.value')).toBe(true);
    expect(isValidFieldPath('core::UiInput.placeholder')).toBe(true);
  });

  it('accepts hyphenated asset-packs component field paths', () => {
    // Regression: `asset-packs::UI` has a hyphen — the field-path regex must
    // allow it so callback/visible bindings on the UI marker don't throw.
    expect(isValidFieldPath('asset-packs::UI.onMouseDown')).toBe(true);
    expect(isValidFieldPath('asset-packs::UI.onMouseUp')).toBe(true);
    expect(isValidFieldPath('asset-packs::UI.visible')).toBe(true);
  });

  it('rejects malformed paths', () => {
    expect(isValidFieldPath('nodot')).toBe(false);
    expect(isValidFieldPath('bad path.value')).toBe(false);
    expect(isValidFieldPath('.value')).toBe(false);
  });
});

describe('assertFieldPath', () => {
  it('does not throw for a hyphenated component path', () => {
    expect(() => assertFieldPath('asset-packs::UI.onMouseDown')).not.toThrow();
  });

  it('throws for an invalid path', () => {
    expect(() => assertFieldPath('not a path')).toThrow();
  });
});

describe('isValidIdentifier', () => {
  it('accepts identifiers and rejects non-identifiers', () => {
    expect(isValidIdentifier('playerName')).toBe(true);
    expect(isValidIdentifier('_x$1')).toBe(true);
    expect(isValidIdentifier('1bad')).toBe(false);
    expect(isValidIdentifier('has-hyphen')).toBe(false);
  });
});

describe('sanitizeNodeName', () => {
  it('keeps alphanumerics, underscore, dollar, and spaces', () => {
    expect(sanitizeNodeName('My Button_2')).toBe('My Button_2');
    expect(sanitizeNodeName('Score$Text')).toBe('Score$Text');
  });

  it('strips characters that could inject into generated TypeScript', () => {
    // Quotes, backticks, `${`, backslashes and newlines are the codegen
    // injection / build-break vectors called out in CLAUDE.md. `$` itself is a
    // legal identifier char (kept), but the `{`/`}` that make `${...}`
    // interpolation are stripped, and `.` (not in the allow-set) goes too.
    expect(sanitizeNodeName('name"; evil()//')).toBe('name evil');
    expect(sanitizeNodeName('`${process.env}`')).toBe('$processenv');
    expect(sanitizeNodeName('a\nb\\c')).toBe('abc');
  });

  it('reduces a fully-hostile name to empty (caller treats as no-op)', () => {
    expect(sanitizeNodeName('<>/{}()"\'`')).toBe('');
  });
});
