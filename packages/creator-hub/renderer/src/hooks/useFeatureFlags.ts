import { useSelector } from '#store';

export const useFeatureFlags = () => {
  const { flags } = useSelector(state => state.featureFlags);
  return { flags };
};
