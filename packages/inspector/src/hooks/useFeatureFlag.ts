import { useAppSelector } from '../redux/hooks';
import { isFeatureFlagEnabled } from '../redux/feature-flags';

export function useFeatureFlag(flag: string): boolean {
  return useAppSelector(state => isFeatureFlagEnabled(state, flag));
}
