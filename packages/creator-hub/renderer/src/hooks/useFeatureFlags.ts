import { useCallback } from 'react';
import { useSelector } from '#store';

export const useFeatureFlags = () => {
  const { flags, variants, status } = useSelector(state => state.featureFlags);

  const isFeatureFlagEnabled = useCallback((flag: string) => !!flags[flag], [flags]);

  const getVariant = useCallback(
    (flag: string) => {
      const variant = variants[flag];
      if (!variant?.payload) return undefined;

      if (variant.payload.type === 'json') {
        try {
          return JSON.parse(variant.payload.value);
        } catch {
          return undefined;
        }
      }

      return variant.payload.value;
    },
    [variants],
  );

  return {
    flags,
    status,
    isFeatureFlagEnabled,
    getVariant,
  };
};
