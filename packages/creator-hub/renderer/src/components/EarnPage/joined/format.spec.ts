import { describe, expect, it } from 'vitest';

import { formatUsdc } from './format';

describe('formatUsdc', () => {
  describe('when the amount is a decimal string', () => {
    it.each([
      ['22.00', '22'],
      ['22', '22'],
      ['1842', '1,842'],
      ['1842.50', '1,842.50'],
      ['1842.5', '1,842.50'],
      ['0.49', '0.49'],
      ['0.004', '0.004'],
      ['1.005', '1.005'],
      ['9.999999', '9.999999'],
      ['12345678901234567.89', '12,345,678,901,234,567.89'],
    ])('should show %s as %s, never rounded', (amount, shown) => {
      expect(formatUsdc(amount, 'en')).toBe(shown);
    });
  });

  describe('when the amount is not a plain decimal', () => {
    it.each([[''], ['abc'], ['1e3'], ['n/a']])('should show %j as sent, never NaN', amount => {
      expect(formatUsdc(amount, 'en')).toBe(amount);
    });
  });
});
