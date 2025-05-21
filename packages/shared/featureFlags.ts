import { fetchFlags } from '@dcl/feature-flags';
import { tryCatch } from './try-catch';
import { ApplicationName } from './types/featureFlags';
import type { FeatureFlagOptions, FeatureFlagsData } from './types/featureFlags';

export async function fetchFeatureFlags(
  options: FeatureFlagOptions = { applicationName: [ApplicationName.DAPPS] },
): Promise<FeatureFlagsData> {
  // Use try-catch utility to handle errors gracefully
  const [data, error] = await tryCatch(fetchFlags(options));

  // If there's an error or the result is undefined, return empty objects
  if (error || !data) {
    console.error('Error fetching feature flags:', error);
    return { flags: {}, variants: {} };
  }

  return data as FeatureFlagsData;
}

/**
 * Checks if a feature flag is enabled using fully qualified name (appName-featureName)
 * This is a low-level function - usually you want to use the higher-level functions
 * that handle the appName prefix for you.
 * @param data Feature flags data
 * @param fullFlagName Full flag name including app prefix (e.g., "dapps-launcher-links")
 * @returns Whether the feature flag is enabled
 */
export function isFeatureFlagEnabled(
  data: FeatureFlagsData | undefined,
  fullFlagName: string,
): boolean {
  return !!data?.flags && !!data.flags[fullFlagName];
}

/**
 * Gets variant data for a feature flag using fully qualified name (appName-featureName)
 * This is a low-level function - usually you want to use the higher-level functions
 * that handle the appName prefix for you.
 * @param data Feature flags data
 * @param fullVariantName Full variant name including app prefix (e.g., "dapps-launcher-links")
 * @returns The variant data
 */
export function getVariant(data: FeatureFlagsData | undefined, fullVariantName: string): any {
  const payload = data?.variants?.[fullVariantName]?.payload;

  if (payload) {
    if (payload.type === 'json') {
      try {
        return JSON.parse(payload.value);
      } catch (error) {
        console.error('Error parsing JSON for feature flag variant', fullVariantName, error);
        return undefined;
      }
    }

    return payload.value;
  }

  return undefined;
}
