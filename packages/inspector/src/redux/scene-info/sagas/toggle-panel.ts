import { put } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { togglePanel } from '../../ui';
import { PanelName } from '../../ui/types';

export function* toggleInfoPanelSaga(action: PayloadAction<boolean>) {
  const isPanelEnabled = action.payload;

  yield put(togglePanel({ panel: PanelName.SCENE_INFO, enabled: isPanelEnabled }));
}
