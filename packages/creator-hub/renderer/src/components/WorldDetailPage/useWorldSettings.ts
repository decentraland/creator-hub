import { useEffect } from 'react';

import { useDispatch, useSelector } from '#store';
import type { WorldSettings } from '/@/lib/worlds';
import { fetchWorldSettings } from '/@/modules/store/management/slice';

/** The World's settings, fetched on mount: the loaded settings, `'loading'` or `'failed'`. A same-World refetch keeps the loaded ones. */
export function useWorldSettings(worldName: string): WorldSettings | 'loading' | 'failed' {
  const dispatch = useDispatch();
  const state = useSelector(store => store.management.worldSettings);

  useEffect(() => {
    void dispatch(fetchWorldSettings({ worldName }));
  }, [dispatch, worldName]);

  if (state.worldName !== worldName) return 'loading';
  if (state.status === 'succeeded') return state.settings;
  if (state.status === 'loading' && Object.keys(state.settings).length > 0) return state.settings;
  return state.status === 'failed' ? 'failed' : 'loading';
}
