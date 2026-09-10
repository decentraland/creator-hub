import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeatureFlag } from './types';
import { FLAG_OVERRIDES_KEY, applyFlagOverrides } from './overrides';

const SERVICE_FLAGS = { 'creatorhub-something': true };

/** Stands in for localStorage so a test never depends on the real one. */
const storageWith = (value: string | null) => ({ getItem: () => value });

describe('applyFlagOverrides', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('when nothing is stored', () => {
    it('should return the service flags untouched', () => {
      expect(applyFlagOverrides(SERVICE_FLAGS, storageWith(null))).toEqual(SERVICE_FLAGS);
    });
  });

  describe('when a flag is forced on', () => {
    it('should add it to the service flags', () => {
      const flags = applyFlagOverrides(
        SERVICE_FLAGS,
        storageWith(JSON.stringify({ [FeatureFlag.ANALYTICS]: true })),
      );

      expect(flags[FeatureFlag.ANALYTICS]).toBe(true);
      expect(flags['creatorhub-something']).toBe(true);
    });

    it('should win over the value the service returned', () => {
      const flags = applyFlagOverrides(
        { [FeatureFlag.ANALYTICS]: true },
        storageWith(JSON.stringify({ [FeatureFlag.ANALYTICS]: false })),
      );

      expect(flags[FeatureFlag.ANALYTICS]).toBe(false);
    });
  });

  describe('when the stored value is unusable', () => {
    it.each([
      ['not JSON', 'creatorhub-analytics=true'],
      ['an array', '["creatorhub-analytics"]'],
      ['a bare string', '"creatorhub-analytics"'],
    ])('should ignore %s and keep the service flags', (_case, stored) => {
      expect(applyFlagOverrides(SERVICE_FLAGS, storageWith(stored))).toEqual(SERVICE_FLAGS);
    });

    it('should drop non-boolean entries, so a truthy string cannot switch a flag on', () => {
      const flags = applyFlagOverrides(
        SERVICE_FLAGS,
        storageWith(JSON.stringify({ [FeatureFlag.ANALYTICS]: 'true' })),
      );

      expect(flags[FeatureFlag.ANALYTICS]).toBeUndefined();
    });
  });

  describe('when storage cannot be read', () => {
    it('should fall back to the service flags', () => {
      const storage = {
        getItem: () => {
          throw new Error('denied');
        },
      };

      expect(applyFlagOverrides(SERVICE_FLAGS, storage)).toEqual(SERVICE_FLAGS);
    });
  });

  it('should expose the key the console command uses', () => {
    expect(FLAG_OVERRIDES_KEY).toBe('creator-hub:feature-flags');
  });
});
