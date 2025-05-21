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
  const mockFlags = {
    flags: {
      'test-flag': true,
      'disabled-flag': false,
    },
    variants: {
      'test-variant': {
        name: 'test-variant',
        payload: {
          type: 'plain',
          value: 'variant-value',
        },
      },
      'json-variant': {
        name: 'json-variant',
        payload: {
          type: 'json',
          value: '{"key": "value"}',
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('should load feature flags successfully', async () => {
    // Mock successful fetch
    (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags());

    // Wait for the hook to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(mockFlags);
    expect(result.current.error).toBeNull();
    expect(fetchFeatureFlags).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when fetching feature flags', async () => {
    const error = new Error('Failed to fetch feature flags');
    (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    const { result } = renderHook(() => useFeatureFlags());

    // Wait for the hook to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch feature flags');
  });

  it('should check if a feature flag is enabled', async () => {
    (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags());

    // Wait for the hook to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFeatureFlagEnabled('test-flag')).toBe(true);
    expect(result.current.isFeatureFlagEnabled('disabled-flag')).toBe(false);
    expect(result.current.isFeatureFlagEnabled('non-existent-flag')).toBe(false);
  });

  it('should retrieve variant data', async () => {
    (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags());

    // Wait for the hook to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getVariants('test-variant')).toEqual({
      type: 'plain',
      value: 'variant-value',
    });

    expect(result.current.getVariants('json-variant')).toEqual({
      type: 'json',
      value: '{"key": "value"}',
    });

    expect(result.current.getVariants('non-existent-variant')).toBeUndefined();
  });

  it('should refetch when options change', async () => {
    (fetchFeatureFlags as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlags);

    const { result, rerender } = renderHook((props: FeatureFlagOptions) => useFeatureFlags(props), {
      initialProps: { applicationName: [ApplicationName.DAPPS] },
    });

    // Wait for the initial fetch to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Change props and rerender
    rerender({ applicationName: [ApplicationName.DAPPS, ApplicationName.BUILDER] });

    // It should be loading again
    expect(result.current.loading).toBe(true);

    // Wait for the second fetch to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    // fetchFeatureFlags should have been called twice with different args
    expect(fetchFeatureFlags).toHaveBeenCalledTimes(2);
  });
});
