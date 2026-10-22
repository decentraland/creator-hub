import { describe, expect, it } from 'vitest';

import { hashUnit } from './hash';

describe('hashUnit', () => {
  describe('when seeds differ only in their last character', () => {
    it('should still spread them across [0, 1)', () => {
      // Single digits: only the very last character changes.
      const values = Array.from({ length: 10 }, (_, i) => hashUnit(`cycle:places:${i}`));

      // Not a max-min spread: clustered values can wrap around 1 and fake one.
      const quarters = new Set(values.map(value => Math.floor(value * 4)));
      expect(quarters.size).toBeGreaterThanOrEqual(3);
    });
  });

  it('should answer the same for the same seed', () => {
    expect(hashUnit('world:foo.dcl.eth')).toBe(hashUnit('world:foo.dcl.eth'));
  });
});
