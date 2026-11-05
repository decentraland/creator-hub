import { describe, expect, it } from 'vitest';

import { formatAddress, isAddress, normalizeAddress } from './ethereum';

describe('when formatting an address for display', () => {
  it('should keep the first twelve and last eight characters', () => {
    expect(formatAddress('0x0000000000000000000000000000000000000001')).toBe(
      '0x0000000000...00000001',
    );
  });

  it('should return an empty value untouched', () => {
    expect(formatAddress('')).toBe('');
  });

  it('should return a value that is not an address verbatim', () => {
    expect(formatAddress('not-an-address')).toBe('not-an-address');
  });

  it('should preserve the checksum casing of a mixed-case address', () => {
    expect(formatAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(
      '0x5aAeb6053F...Ef1BeAed',
    );
  });

  it('should format a prefixless address, which isAddress accepts', () => {
    expect(formatAddress('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '5aaeb6053f3e...ef1beaed',
    );
  });
});

describe('when comparing two spellings of one address', () => {
  it('should fold the 0x prefix into one identity', () => {
    expect(normalizeAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(
      normalizeAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'),
    );
  });

  it('should fold checksum casing into one identity', () => {
    expect(normalizeAddress('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED')).toBe(
      normalizeAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
    );
  });
});

describe('when normalizing an address', () => {
  it('should return a lowercase, 0x-prefixed address', () => {
    expect(normalizeAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(
      '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
    );
  });
});

describe('when validating an address', () => {
  it.each([
    ['lowercase', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'],
    ['upper-case hex after a 0x prefix', '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED'],
    ['fully upper-case, prefix included', '0X5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED'],
    ['EIP-55 checksummed', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'],
    ['prefixless', '5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'],
  ])('should accept a %s address', (_, address) => {
    expect(isAddress(address)).toBe(true);
  });

  it('should reject a mixed-case address whose checksum is wrong', () => {
    expect(isAddress('0x5aAeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(false);
  });

  it('should reject a shortened display address', () => {
    expect(isAddress('0x5aAeb6053F...Ef1BeAed')).toBe(false);
  });
});
