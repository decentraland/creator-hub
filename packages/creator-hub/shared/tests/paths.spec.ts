import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isInside } from '../paths';

describe('isInside', () => {
  const base = path.resolve('/projects/scene');

  describe('when the target is within the base', () => {
    it('should accept a direct child', () => {
      expect(isInside(base, path.join(base, 'scene.json'))).toBe(true);
    });

    it('should accept a deeply nested descendant', () => {
      expect(isInside(base, path.join(base, 'assets', 'scene', 'main.composite'))).toBe(true);
    });

    it('should accept the base itself', () => {
      expect(isInside(base, base)).toBe(true);
    });

    it('should accept a path whose ".." segments resolve back inside', () => {
      expect(isInside(base, path.join(base, 'assets', '..', 'scene.json'))).toBe(true);
    });
  });

  describe('when the target is outside the base', () => {
    it('should reject the parent directory', () => {
      expect(isInside(base, path.dirname(base))).toBe(false);
    });

    it('should reject a path that climbs out with ".."', () => {
      expect(isInside(base, path.join(base, '..', '..', 'etc', 'hosts'))).toBe(false);
    });

    // The reason this compares with `path.relative` and not `startsWith`: the sibling's
    // full path begins with the base's full path.
    it('should reject a sibling that shares the base as a string prefix', () => {
      expect(isInside(base, `${base}-other`)).toBe(false);
      expect(isInside(base, `${base}-other/file.txt`)).toBe(false);
    });
  });
});
