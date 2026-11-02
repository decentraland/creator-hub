import { describe, expect, it } from 'vitest';

import { isFileOnly } from './catalog';

describe('isFileOnly', () => {
  describe('when the asset has no composite components', () => {
    it('should be file-only, so placing it adds no entity', () => {
      expect(isFileOnly({ composite: { version: 1, components: [] } })).toBe(true);
    });
  });

  describe('when the asset has a GltfContainer', () => {
    it('should not be file-only', () => {
      expect(
        isFileOnly({
          composite: {
            version: 1,
            components: [{ name: 'core::GltfContainer', data: { 0: { json: { src: 'a.glb' } } } }],
          },
        }),
      ).toBe(false);
    });
  });
});
