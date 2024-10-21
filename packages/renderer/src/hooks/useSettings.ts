import { useCallback } from 'react';

import { useDispatch, useSelector } from '#store';

import { type AppSettings } from '/shared/types/settings';

import { actions as workspaceActions } from '/@/modules/store/workspace';

export const useSettings = () => {
  const dispatch = useDispatch();
  const { settings } = useSelector(state => state.workspace);

  const updateAppSettings = useCallback((settings: AppSettings) => {
    dispatch(workspaceActions.updateSettings(settings));
  }, []);

  return {
    settings,
    updateAppSettings,
  };
};
