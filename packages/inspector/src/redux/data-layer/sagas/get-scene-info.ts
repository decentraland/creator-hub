import { call, put } from 'redux-saga/effects';

import type { GetFileResponse } from '../../../lib/data-layer/remote-data-layer';
import type { IDataLayer } from '..';
import {
  SCENE_INFO_FILE,
  setSceneInfoContent,
  setSceneInfoLoading,
  getDataLayerInterface,
} from '..';

export function* getSceneInfoContentSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    yield put(setSceneInfoLoading(true));
    const response: GetFileResponse = yield call(dataLayer.getFile, {
      path: SCENE_INFO_FILE,
    });
    const content = Buffer.from(response.content).toString('utf-8');
    yield put(setSceneInfoContent(content));
  } catch (e) {
    // File doesn't exist. Not an error, just empty state
    yield put(setSceneInfoContent(''));
  } finally {
    yield put(setSceneInfoLoading(false));
  }
}
