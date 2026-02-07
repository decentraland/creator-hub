import { useEffect } from 'react';
import { useDispatch, useSelector } from '/@/modules/store';
import {
  selectors as profilesSelectors,
  actions as profilesActions,
} from '/@/modules/store/profiles';

/** Hook to fetch and store the profile data for a given address.
 * @param walletAddress - The wallet address of the profile to fetch. */
export const useProfile = (walletAddress: string) => {
  const dispatch = useDispatch();
  const profileState = useSelector(state => profilesSelectors.getProfile(state, walletAddress));

  useEffect(() => {
    if (walletAddress && !profileState) {
      dispatch(profilesActions.fetchProfile({ address: walletAddress }));
    }
  }, [walletAddress]);

  return {
    avatar: profileState?.avatar,
    isLoading: profileState?.status === 'loading',
    isNotFound: profileState?.status === 'not_found',
  };
};
