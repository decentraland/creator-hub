import { useCallback } from 'react';

import { useSelector } from '#store';
import type { FeatureFlag } from '/@/modules/store/featureFlags';

export const useFeatureFlags = () => {
  const { flags } = useSelector(state => state.featureFlags);

  /** A flag the service has not returned is off. */
  const isEnabled = useCallback((flag: FeatureFlag) => flags[flag] === true, [flags]);

  return { flags, isEnabled };
};
