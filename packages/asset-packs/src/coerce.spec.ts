import { describe, it, expect } from 'vitest';
import { coerceToString } from './coerce';

describe('coerceToString', () => {
  describe('when the value is a string', () => {
    it('should return it unchanged', () => {
      expect(coerceToString('hello')).toBe('hello');
      expect(coerceToString('')).toBe('');
    });
  });

  describe('when the value is a number', () => {
    it('should stringify finite numbers', () => {
      expect(coerceToString(0)).toBe('0');
      expect(coerceToString(42)).toBe('42');
      expect(coerceToString(-3.5)).toBe('-3.5');
    });
    it('should return an empty string for non-finite numbers', () => {
      expect(coerceToString(NaN)).toBe('');
      expect(coerceToString(Infinity)).toBe('');
    });
  });

  describe('when the value is a boolean', () => {
    it('should return "true" / "false"', () => {
      expect(coerceToString(true)).toBe('true');
      expect(coerceToString(false)).toBe('false');
    });
  });

  describe('when the value is an array', () => {
    it('should join coerced elements with ", "', () => {
      expect(coerceToString(['a', 'b', 'c'])).toBe('a, b, c');
      expect(coerceToString([1, 2, 3])).toBe('1, 2, 3');
      expect(coerceToString([])).toBe('');
    });
  });

  describe('when the value is a Color4-like object', () => {
    it('should format lowercase #rrggbb and drop alpha', () => {
      expect(coerceToString({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
      expect(coerceToString({ r: 0, g: 1, b: 0 })).toBe('#00ff00');
      expect(coerceToString({ r: 0, g: 0, b: 1, a: 0.5 })).toBe('#0000ff');
    });
    it('should clamp out-of-range channels', () => {
      expect(coerceToString({ r: 2, g: -1, b: 0 })).toBe('#ff0000');
    });
  });

  describe('when the value is null or undefined', () => {
    it('should return an empty string', () => {
      expect(coerceToString(null)).toBe('');
      expect(coerceToString(undefined)).toBe('');
    });
  });
});
