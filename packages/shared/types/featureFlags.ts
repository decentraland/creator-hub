import type { FeatureFlagOptions, FeatureFlagVariant } from '@dcl/feature-flags';

export enum ApplicationName {
  DAPPS = 'dapps',
  BUILDER = 'builder',
}

export enum FeatureName {
  LAUNCHER_LINKS = 'launcher-links',
}

export interface FeatureFlagsData {
  flags: Record<string, boolean>;
  variants: Record<string, FeatureFlagVariant>;
}

export type { FeatureFlagOptions, FeatureFlagVariant };
