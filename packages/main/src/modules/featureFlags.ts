import { fetchFeatureFlags, getVariant as getVariantData } from '/shared/featureFlags';
import { ApplicationName } from '/shared/types/featureFlags';
import type { FeatureFlagOptions, FeatureFlagsData } from '/shared/types/featureFlags';

let featureFlagsCache: FeatureFlagsData | undefined;
let lastFetchTime = 0;
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute cache

/**
 * Fetches feature flags with optional caching
 * @param options Feature flag options
 * @param useCache Whether to use cached feature flags if available
 * @returns Feature flags data
 */
export async function getFeatureFlags(
  options: FeatureFlagOptions = { applicationName: [ApplicationName.DAPPS] },
  useCache = true,
): Promise<FeatureFlagsData> {
  const now = Date.now();

  // If cache is enabled and we have a valid cache, return it
  if (useCache && featureFlagsCache && now - lastFetchTime < CACHE_DURATION) {
    return featureFlagsCache;
  }

  // Otherwise fetch fresh data
  featureFlagsCache = await fetchFeatureFlags(options);
  console.log('[FeatureFlags] Fetched feature flags:', { featureFlagsCache });
  lastFetchTime = now;

  return featureFlagsCache;
}

/**
 * Checks if a feature flag is enabled
 * @param featureName Name of the feature flag without app prefix
 * @param options Feature flag options
 * @param applicationName Optional specific application name to check
 * @returns Whether the feature is enabled
 */
export async function isFeatureFlagEnabled(
  featureName: string,
  options?: FeatureFlagOptions,
  applicationName?: ApplicationName,
): Promise<boolean> {
  const data = await getFeatureFlags(options);
  if (!data?.flags) return false;

  const appNames = options?.applicationName || [ApplicationName.DAPPS];

  // If a specific app is provided, only check that app
  if (applicationName) {
    const fullFeatureName = `${applicationName}-${featureName}`;
    return !!data.flags[fullFeatureName];
  }

  // Otherwise check all applications in the options
  for (const appName of appNames) {
    const fullFeatureName = `${appName}-${featureName}`;
    if (data.flags[fullFeatureName]) {
      return true;
    }
  }

  return false;
}

/**
 * Gets variant data for a feature flag
 * @param featureName Name of the variant without app prefix
 * @param options Feature flag options
 * @param applicationName Optional specific application name to check
 * @returns The variant data
 */
export async function getFeatureFlagVariant(
  featureName: string,
  options?: FeatureFlagOptions,
  applicationName?: ApplicationName,
): Promise<any> {
  const data = await getFeatureFlags(options);
  if (!data?.variants) return undefined;

  const appNames = options?.applicationName || [ApplicationName.DAPPS];

  // If a specific app is provided, only check that app
  if (applicationName) {
    const fullFeatureName = `${applicationName}-${featureName}`;
    return getVariantData(data, fullFeatureName);
  }

  // Otherwise check all applications in the options
  for (const appName of appNames) {
    const fullFeatureName = `${appName}-${featureName}`;
    const variant = getVariantData(data, fullFeatureName);
    if (variant !== undefined) {
      return variant;
    }
  }

  return undefined;
}
