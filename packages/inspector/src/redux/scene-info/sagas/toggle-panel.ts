import { call, put } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { togglePanel } from '../../ui';
import { PanelName } from '../../ui/types';
import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';

export function* toggleInfoPanelSaga(action: PayloadAction<boolean>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  // Toggle the panel in UI
  const isPanelEnabled = action.payload;
  yield put(togglePanel({ panel: PanelName.SCENE_INFO, enabled: isPanelEnabled }));

  // Save the new state to the component (visible = not hidden after toggle)
  yield call(dataLayer.setInspectorUIState, {
    sceneInfoPanelVisible: isPanelEnabled,
  });
}
