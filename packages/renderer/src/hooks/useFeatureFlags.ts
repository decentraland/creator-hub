import { useCallback, useEffect, useState } from 'react';
import {
  fetchFeatureFlags,
  isFeatureFlagEnabled as checkFlag,
  getVariant as getVariantData,
} from '/shared/featureFlags';
import { ApplicationName } from '/shared/types/featureFlags';
import type { FeatureFlagOptions, FeatureFlagsData, FeatureName } from '/shared/types/featureFlags';

export const useFeatureFlags = (
  options: FeatureFlagOptions = { applicationName: [ApplicationName.DAPPS] },
) => {
  const [data, setData] = useState<FeatureFlagsData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch feature flags on component mount or when options change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadFeatureFlags = async () => {
      try {
        const result = await fetchFeatureFlags(options);
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error fetching feature flags'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFeatureFlags();

    return () => {
      isMounted = false;
    };
  }, [
    // Using stringify to avoid dependency issues with arrays
    JSON.stringify(options.applicationName),
  ]);

  const isFeatureFlagEnabled = useCallback(
    (value: FeatureName | string) => {
      return checkFlag(data, value);
    },
    [data],
  );

  const getVariants = useCallback(
    (value: string) => {
      return getVariantData(data, value);
    },
    [data],
  );

  return {
    data,
    loading,
    error,
    isFeatureFlagEnabled,
    getVariants,
  };
};
