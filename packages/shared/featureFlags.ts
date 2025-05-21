import { fetchFlags } from '@dcl/feature-flags';
import { tryCatch } from './try-catch';
import { ApplicationName } from './types/featureFlags';
import type { FeatureFlagOptions, FeatureFlagsData, FeatureName } from './types/featureFlags';

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

export function isFeatureFlagEnabled(
  data: FeatureFlagsData | undefined,
  flagName: FeatureName | string,
): boolean {
  return !!data?.flags && !!data.flags[flagName];
}

export function getVariant(data: FeatureFlagsData | undefined, variantName: string): any {
  const payload = data?.variants?.[variantName]?.payload;

  if (payload) {
    if (payload.type === 'json') {
      try {
        return JSON.parse(payload.value);
      } catch (error) {
        console.error('Error parsing JSON for feature flag variant', variantName, error);
        return undefined;
      }
    }

    return payload.value;
  }

  return undefined;
}
