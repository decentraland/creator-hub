import { describe, it, expect } from 'vitest';

import { isValidFieldPath, isValidIdentifier, assertFieldPath } from './validators';

describe('isValidFieldPath', () => {
  it('accepts core component field paths', () => {
    expect(isValidFieldPath('core::UiText.value')).toBe(true);
    expect(isValidFieldPath('core::UiInput.placeholder')).toBe(true);
  });

  it('accepts the editor-internal event namespace', () => {
    expect(isValidFieldPath('ui::events.onMouseDown')).toBe(true);
    expect(isValidFieldPath('ui::events.onMouseUp')).toBe(true);
  });

  it('rejects malformed paths', () => {
    expect(isValidFieldPath('nodot')).toBe(false);
    expect(isValidFieldPath('bad path.value')).toBe(false);
    expect(isValidFieldPath('.value')).toBe(false);
  });
});

describe('assertFieldPath', () => {
  it('does not throw for a namespaced event path', () => {
    expect(() => assertFieldPath('ui::events.onMouseDown')).not.toThrow();
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
