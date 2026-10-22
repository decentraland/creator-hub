import { useEffect } from 'react';

import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/creatorFund';

import { useAuth } from './useAuth';

/**
 * The signed-in creator's Creator Fund state, loaded once per wallet.
 *
 * Every surface that shows fund state (banner, Manage tiles, the fund page)
 * goes through here, so whichever renders first does the loading.
 */
export const useCreatorFund = () => {
  const { wallet, isSignedIn } = useAuth();
  const state = useSelector(store => store.creatorFund);
  const dispatch = useDispatch();

  useEffect(() => {
    if (wallet && state.address !== wallet) {
      dispatch(actions.loadCreatorFund({ address: wallet }));
    }
  }, [wallet, state.address]);

  return {
    ...state,
    wallet,
    isSignedIn,
    isEnrolled: !!state.enrollment,
    isLoaded: !!wallet && state.address === wallet && state.loadStatus === 'succeeded',
  };
};
