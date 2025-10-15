import { call, put } from 'redux-saga/effects';

import type { IDataLayer } from '../';
import {
  getAssetCatalog,
  getDataLayerInterface,
  getInspectorPreferences,
  getThumbnails,
} from '../';
import { initializeSceneInfoPanel } from '../../scene-info';

export function* connectedSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  yield put(getInspectorPreferences());
  yield put(getAssetCatalog());
  yield put(getThumbnails());
  yield put(initializeSceneInfoPanel());
}
