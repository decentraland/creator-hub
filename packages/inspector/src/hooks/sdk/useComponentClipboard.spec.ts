import { describe, it, expect } from 'vitest';

import { matchesSchemaShape } from './useComponentClipboard';

// `matchesSchemaShape` guards clipboard paste: a payload's field types must be
// runtime-compatible with a fresh component schema default before it is written
// into the CRDT, so a crafted clipboard value can't crash the PB serializer
// per-tick (the "Cannot convert … to a BigInt" class — see the hook comment).
describe('matchesSchemaShape', () => {
  // Mirrors the shape of a core::UiTransform default (numbers + nested map).
  const defaults = {
    width: 0,
    height: 0,
    display: 0, // enum-int, defaults to a number
    positionType: 0,
    position: { top: 0, right: 0, bottom: 0, left: 0 },
    flexGrow: 0,
  };

  describe('when the payload matches the schema types', () => {
    it('accepts a well-typed partial value', () => {
      expect(matchesSchemaShape({ width: 100, height: 50 }, defaults)).toBe(true);
    });

    it('accepts a nested map with correct leaf types', () => {
      expect(matchesSchemaShape({ position: { top: 5, left: 10 } }, defaults)).toBe(true);
    });

    it('ignores keys absent from the schema default', () => {
      // Unknown keys are dropped by the serializer anyway — they must not fail.
      expect(matchesSchemaShape({ width: 1, __unknown: 'x' }, defaults)).toBe(true);
    });
  });

  describe('when the payload has a mistyped field', () => {
    it('rejects a string where a number is expected', () => {
      // The finding's exact example.
      expect(matchesSchemaShape({ width: 'notanumber' }, defaults)).toBe(false);
    });

    it('rejects a non-finite number', () => {
      expect(matchesSchemaShape({ height: Number.POSITIVE_INFINITY }, defaults)).toBe(false);
    });

    it('rejects a mistyped leaf inside a nested map', () => {
      expect(matchesSchemaShape({ position: { top: 'x' } }, defaults)).toBe(false);
    });

    it('rejects an array where a map is expected', () => {
      expect(matchesSchemaShape({ position: [1, 2, 3] }, defaults)).toBe(false);
    });
  });

  describe('when the payload is not a plain object', () => {
    it('rejects arrays, primitives, and null', () => {
      expect(matchesSchemaShape([1, 2], defaults)).toBe(false);
      expect(matchesSchemaShape('nope', defaults)).toBe(false);
      expect(matchesSchemaShape(null, defaults)).toBe(false);
    });
  });
});
