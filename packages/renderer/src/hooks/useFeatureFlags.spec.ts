import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { fetchFeatureFlags } from '../../../shared/featureFlags';
import { ApplicationName } from '../../../shared/types/featureFlags';
import type { FeatureFlagOptions } from '../../../shared/types/featureFlags';
import { useFeatureFlags } from './useFeatureFlags';

// Mock the feature flags module
vi.mock('../../../shared/featureFlags', () => ({
  fetchFeatureFlags: vi.fn(),
  isFeatureFlagEnabled: vi.fn((data, flagName) => !!data?.flags?.[flagName]),
  getVariant: vi.fn((data, variantName) => data?.variants?.[variantName]?.payload),
}));

describe('useFeatureFlags', () => {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when initializing the hook', () => {
    let result: { current: ReturnType<typeof useFeatureFlags> };

    beforeEach(() => {
      const hook = renderHook(() => useFeatureFlags());
      result = hook.result;
    });

    it('should show loading state initially', () => {
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });

  describe('when fetching feature flags', () => {
    describe('and the fetch is successful', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
        const hook = renderHook(() => useFeatureFlags());
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should set the data from the fetch result', () => {
        expect(result.current.data).toEqual(mockFlags);
      });

      it('should set error to null', () => {
        expect(result.current.error).toBeNull();
      });

      it('should have called fetchFeatureFlags once', () => {
        expect(fetchFeatureFlags).toHaveBeenCalledTimes(1);
      });
    });

    describe('and the fetch fails', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };
      const error = new Error('Failed to fetch feature flags');

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockRejectedValue(error);
        const hook = renderHook(() => useFeatureFlags());
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should not set any data', () => {
        expect(result.current.data).toBeUndefined();
      });

      it('should set the error', () => {
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Failed to fetch feature flags');
      });
    });
  });

  describe('when checking feature flags', () => {
    describe('and checking across all configured apps', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
        const hook = renderHook(() =>
          useFeatureFlags({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] }),
        );
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should return true for flags enabled in any app', () => {
        expect(result.current.isFeatureFlagEnabled('test-flag')).toBe(true);
      });

      it('should return false for flags disabled in all apps', () => {
        expect(result.current.isFeatureFlagEnabled('disabled-flag')).toBe(false);
      });

      it('should return false for non-existent flags', () => {
        expect(result.current.isFeatureFlagEnabled('non-existent-flag')).toBe(false);
      });
    });

    describe('and checking for a specific app', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
        const hook = renderHook(() =>
          useFeatureFlags({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] }),
        );
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should check flags only for the dapps app when specified', () => {
        expect(result.current.isFeatureFlagEnabled('test-flag', ApplicationName.DAPPS)).toBe(true);
        expect(result.current.isFeatureFlagEnabled('another-flag', ApplicationName.DAPPS)).toBe(
          false,
        );
      });

      it('should check flags only for the builder app when specified', () => {
        expect(result.current.isFeatureFlagEnabled('test-flag', ApplicationName.BUILDER)).toBe(
          true,
        );
        expect(result.current.isFeatureFlagEnabled('another-flag', ApplicationName.BUILDER)).toBe(
          false,
        );
      });
    });
  });

  describe('when retrieving variant data', () => {
    describe('and checking across all configured apps', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
        const hook = renderHook(() =>
          useFeatureFlags({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] }),
        );
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should get variant data from the first app that has it', () => {
        expect(result.current.getVariants('test-variant')).toEqual({
          type: 'string',
          value: 'variant-value',
        });
      });

      it('should get json variant data correctly', () => {
        expect(result.current.getVariants('json-variant')).toEqual({
          type: 'json',
          value: '{"key": "value"}',
        });
      });

      it('should return undefined for non-existent variants', () => {
        expect(result.current.getVariants('non-existent-variant')).toBeUndefined();
      });
    });

    describe('and checking for a specific app', () => {
      let result: { current: ReturnType<typeof useFeatureFlags> };

      beforeEach(async () => {
        (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
        const hook = renderHook(() =>
          useFeatureFlags({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] }),
        );
        result = hook.result;
        await waitFor(() => expect(result.current.loading).toBe(false));
      });

      it('should get variant data only from the builder app when specified', () => {
        expect(result.current.getVariants('test-variant', ApplicationName.BUILDER)).toEqual({
          type: 'string',
          value: 'builder-variant-value',
        });
      });

      it('should get variant data only from the dapps app when specified', () => {
        expect(result.current.getVariants('test-variant', ApplicationName.DAPPS)).toEqual({
          type: 'string',
          value: 'variant-value',
        });
      });
    });
  });

  describe('when options change', () => {
    let result: { current: ReturnType<typeof useFeatureFlags> };
    let rerender: any;

    beforeEach(async () => {
      (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);
      // Use any type for the rerender function
      const hook = renderHook(
        (props?: { applicationName: ApplicationName[] }) =>
          useFeatureFlags(props as FeatureFlagOptions),
        {
          initialProps: { applicationName: [ApplicationName.DAPPS] },
        },
      );

      result = hook.result;
      rerender = hook.rerender;

      // Wait for the initial fetch to complete
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Reset the mock to track new calls
      vi.clearAllMocks();
      (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);

      // Change props and rerender
      rerender({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] });
    });

    it('should trigger loading state again', () => {
      expect(result.current.loading).toBe(true);
    });

    it('should fetch feature flags again with new options', async () => {
      // Wait for the second fetch to complete
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetchFeatureFlags).toHaveBeenCalledTimes(1);
      expect(fetchFeatureFlags).toHaveBeenCalledWith({
        applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER],
      });
    });
  });
});
