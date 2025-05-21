import {
  fetchFeatureFlags,
  isFeatureFlagEnabled as checkFlag,
  getVariant,
} from '/shared/featureFlags';
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
 * @param flagName Name of the feature flag
 * @param options Feature flag options
 * @returns Whether the feature is enabled
 */
export async function isFeatureFlagEnabled(
  flagName: string,
  options?: FeatureFlagOptions,
): Promise<boolean> {
  const data = await getFeatureFlags(options);
  return checkFlag(data, flagName);
}

/**
 * Gets variant data for a feature flag
 * @param variantName Name of the variant
 * @param options Feature flag options
 * @returns The variant data
 */
export async function getFeatureFlagVariant(
  variantName: string,
  options?: FeatureFlagOptions,
): Promise<any> {
  const data = await getFeatureFlags(options);
  return getVariant(data, variantName);
}
