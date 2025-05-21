import { useCallback, useEffect, useState } from 'react';
import { fetchFeatureFlags, getVariant as getVariantData } from '/shared/featureFlags';
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

  /**
   * Check if a feature flag is enabled
   * @param featureName Name of the feature flag without app prefix
   * @param applicationName Optional specific application name to check
   * @returns Whether the feature flag is enabled
   */
  const isFeatureFlagEnabled = useCallback(
    (featureName: FeatureName | string, applicationName?: ApplicationName): boolean => {
      if (!data?.flags) return false;

      // If a specific app is provided, only check that app
      if (applicationName) {
        const fullFeatureName = `${applicationName}-${featureName}`;
        return !!data.flags[fullFeatureName];
      }

      // Otherwise check all applications in the options
      for (const appName of options.applicationName) {
        const fullFeatureName = `${appName}-${featureName}`;
        if (data.flags[fullFeatureName]) {
          return true;
        }
      }

      return false;
    },
    [data, options.applicationName],
  );

  /**
   * Get variant data for a feature flag
   * @param featureName Name of the feature flag variant without app prefix
   * @param applicationName Optional specific application name to check
   * @returns The variant data
   */
  const getVariants = useCallback(
    (featureName: string, applicationName?: ApplicationName): any => {
      if (!data?.variants) return undefined;

      // If a specific app is provided, only check that app
      if (applicationName) {
        const fullFeatureName = `${applicationName}-${featureName}`;
        return getVariantData(data, fullFeatureName);
      }

      // Otherwise check all applications in the options
      for (const appName of options.applicationName) {
        const fullFeatureName = `${appName}-${featureName}`;
        const variant = getVariantData(data, fullFeatureName);
        if (variant !== undefined) {
          return variant;
        }
      }

      return undefined;
    },
    [data, options.applicationName],
  );

  return {
    data,
    loading,
    error,
    isFeatureFlagEnabled,
    getVariants,
  };
};
