import { describe, expect, it } from 'vitest';

import { isWalletAddress, shortAddress } from './wallet';

describe('isWalletAddress', () => {
  it.each([
    ['0x followed by 40 hex characters', '0x000000000000000000000000000000000000dEaD', true],
    ['upper-case hex', '0x00000000000000000000000000000000000ABCDE', true],
    ['41 characters', '0x00000000000000000000000000000000000dEaD', false],
    ['43 characters', '0x0000000000000000000000000000000000000dEaD', false],
    ['no 0x prefix', '00000000000000000000000000000000000000dEaD', false],
    ['a non-hex character', '0x000000000000000000000000000000000000dEaG', false],
    ['surrounding spaces', ' 0x000000000000000000000000000000000000dEaD', false],
    ['nothing', '', false],
  ])('should answer for %s', (_name, value, expected) => {
    expect(isWalletAddress(value)).toBe(expected);
  });
});

describe('shortAddress', () => {
  it('should keep the first 7 and the last 6 characters', () => {
    expect(shortAddress('0x6BB7a0000000000000000000000000000Dfb47f')).toBe('0x6BB7a...Dfb47f');
  });
});
