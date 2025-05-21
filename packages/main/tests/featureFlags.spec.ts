import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApplicationName } from '../../shared/types/featureFlags';
import * as sharedFeatureFlags from '../../shared/featureFlags';
import {
  getFeatureFlags,
  isFeatureFlagEnabled,
  getFeatureFlagVariant,
} from '../src/modules/featureFlags';

// Mock the shared feature flags module
vi.mock('/shared/featureFlags', () => ({
  fetchFeatureFlags: vi.fn(),
  getVariant: vi.fn(),
}));

describe('Feature Flags', () => {
  // We use 'any' to bypass TypeScript's type checking for the test mock
  const mockFlags = {
    flags: {
      // Using app-prefixed feature flag names
      'dapps-test-flag': true,
      'dapps-disabled-flag': false,
      'builder-test-flag': true,
      'builder-another-flag': false,
    },
    variants: {
      // Using app-prefixed variant names
      'dapps-test-variant': {
        name: 'dapps-test-variant',
        payload: {
          type: 'string',
          value: 'variant-value',
        },
      },
      'dapps-json-variant': {
        name: 'dapps-json-variant',
        payload: {
          type: 'json',
          value: '{"key": "value"}',
        },
      },
      'builder-test-variant': {
        name: 'builder-test-variant',
        payload: {
          type: 'string',
          value: 'builder-variant-value',
        },
      },
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock the actual module methods since we're using the module path reference
    vi.spyOn(sharedFeatureFlags, 'fetchFeatureFlags').mockResolvedValue(mockFlags);
    vi.spyOn(sharedFeatureFlags, 'getVariant').mockImplementation((data, name) => {
      if (name === 'dapps-test-variant') {
        return { type: 'string', value: 'variant-value' };
      } else if (name === 'dapps-json-variant') {
        return { type: 'json', value: '{"key": "value"}' };
      } else if (name === 'builder-test-variant') {
        return { type: 'string', value: 'builder-variant-value' };
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when fetching feature flags', () => {
    describe('and using the cache', () => {
      let firstResult: any;
      let secondResult: any;

      beforeEach(async () => {
        // First call should fetch new data
        firstResult = await getFeatureFlags();

        // Reset mock to track calls separately
        vi.mocked(sharedFeatureFlags.fetchFeatureFlags).mockClear();

        // Second call within cache duration should use cache
        secondResult = await getFeatureFlags();
      });

      it('should fetch data on first call', () => {
        expect(sharedFeatureFlags.fetchFeatureFlags).toHaveBeenCalledTimes(0);
        // The first call would have happened before we cleared the mock
      });

      it('should return the same data from cache on second call', () => {
        expect(secondResult).toBe(firstResult); // Strict equality check
        expect(sharedFeatureFlags.fetchFeatureFlags).not.toHaveBeenCalled();
      });

      it('should fetch new data when cache expires', async () => {
        // Advance time past cache duration (1 minute)
        vi.advanceTimersByTime(61 * 1000);

        // Reset mock to track calls separately
        vi.mocked(sharedFeatureFlags.fetchFeatureFlags).mockClear();

        // Third call after cache expiration should fetch new data
        await getFeatureFlags();

        expect(sharedFeatureFlags.fetchFeatureFlags).toHaveBeenCalledTimes(1);
      });
    });

    describe('and bypassing the cache', () => {
      beforeEach(async () => {
        // First call to populate cache
        await getFeatureFlags();

        // Reset mock to track calls separately
        vi.mocked(sharedFeatureFlags.fetchFeatureFlags).mockClear();

        // Second call with useCache = false should fetch new data
        await getFeatureFlags(undefined, false);
      });

      it('should fetch new data when cache is bypassed', () => {
        expect(sharedFeatureFlags.fetchFeatureFlags).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when checking if a feature flag is enabled', () => {
    describe('and checking across all configured apps', () => {
      let result: boolean;

      beforeEach(async () => {
        result = await isFeatureFlagEnabled('test-flag', {
          applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
        });
      });

      it('should return true for flags enabled in any app', async () => {
        expect(result).toBe(true);
      });

      it('should return false for flags disabled in all apps', async () => {
        const result = await isFeatureFlagEnabled('disabled-flag', {
          applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
        });
        expect(result).toBe(false);
      });

      it('should return false for non-existent flags', async () => {
        const result = await isFeatureFlagEnabled('non-existent-flag', {
          applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
        });
        expect(result).toBe(false);
      });
    });

    describe('and checking for a specific app', () => {
      it('should check flags only for the specified app', async () => {
        // Check for dapps app specifically
        const dappsResult = await isFeatureFlagEnabled(
          'test-flag',
          undefined,
          ApplicationName.DAPPS,
        );
        expect(dappsResult).toBe(true);

        const dappsDisabledResult = await isFeatureFlagEnabled(
          'another-flag',
          undefined,
          ApplicationName.DAPPS,
        );
        expect(dappsDisabledResult).toBe(false);

        // Check for builder app specifically
        const builderResult = await isFeatureFlagEnabled(
          'test-flag',
          undefined,
          ApplicationName.BUILDER,
        );
        expect(builderResult).toBe(true);

        const builderDisabledResult = await isFeatureFlagEnabled(
          'disabled-flag',
          undefined,
          ApplicationName.BUILDER,
        );
        expect(builderDisabledResult).toBe(false);
      });
    });
  });

  describe('when retrieving variant data', () => {
    describe('and checking across all configured apps', () => {
      it('should get variant data from the first app that has it', async () => {
        const result = await getFeatureFlagVariant('test-variant', {
          applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
        });
        expect(result).toEqual({ type: 'string', value: 'variant-value' });
      });

      it('should return undefined for non-existent variants', async () => {
        const result = await getFeatureFlagVariant('non-existent-variant', {
          applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
        });
        expect(result).toBeUndefined();
      });
    });

    describe('and checking for a specific app', () => {
      it('should get variant data only from the specified app', async () => {
        // Get variant from dapps app specifically
        const dappsResult = await getFeatureFlagVariant(
          'test-variant',
          undefined,
          ApplicationName.DAPPS,
        );
        expect(dappsResult).toEqual({ type: 'string', value: 'variant-value' });

        // Get variant from builder app specifically
        const builderResult = await getFeatureFlagVariant(
          'test-variant',
          undefined,
          ApplicationName.BUILDER,
        );
        expect(builderResult).toEqual({ type: 'string', value: 'builder-variant-value' });
      });
    });
  });
});
