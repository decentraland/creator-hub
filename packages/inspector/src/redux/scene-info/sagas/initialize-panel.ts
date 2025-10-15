import { call, put, select } from 'redux-saga/effects';

import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';
import {
  getSceneInfoContent,
  selectSceneInfo,
  setSceneInfoOpenedInPreviousSession,
  toggleInfoPanel,
} from '../';

export function* initializeSceneInfoPanelSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    yield put(getSceneInfoContent());
    /// TODO: we should get this boolean from persistent storage.
    const { openedInPreviousSession } = yield select(selectSceneInfo);

    // File exists. Restore previous state (open/closed). Default to open if no previous state.
    const openPanel = openedInPreviousSession ?? true;
    yield put(toggleInfoPanel(openPanel));
  } catch (e) {
    yield put(toggleInfoPanel(false));
    yield put(setSceneInfoOpenedInPreviousSession(null));
  }
}
