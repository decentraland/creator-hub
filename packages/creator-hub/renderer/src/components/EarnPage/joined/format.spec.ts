import { describe, expect, it } from 'vitest';

import { formatUsdc } from './format';

describe('formatUsdc', () => {
  describe('when the amount is a decimal string', () => {
    it.each([
      ['1842.50', '1,842.50'],
      ['22', '22.00'],
      ['1.005', '1.01'],
      ['0.005', '0.01'],
      ['12345678901234567.89', '12,345,678,901,234,567.89'],
    ])('should format %s from its decimal value as %s', (amount, shown) => {
      expect(formatUsdc(amount, 'en')).toBe(shown);
    });
  });

  describe('when the amount is not a plain decimal', () => {
    it.each([[''], ['abc'], ['1e3']])('should show %j as sent, never NaN', amount => {
      expect(formatUsdc(amount, 'en')).toBe(amount);
    });
  });
});
