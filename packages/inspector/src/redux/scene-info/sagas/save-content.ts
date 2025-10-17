import type { PayloadAction } from '@reduxjs/toolkit';
import { call, put } from 'redux-saga/effects';

import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';
import { SCENE_INFO_FILE, setSceneInfoContent, setSceneInfoError, setSceneInfoLoading } from '../';

export function* saveSceneInfoContentSaga(action: PayloadAction<string>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    yield put(setSceneInfoLoading(true));
    yield put(setSceneInfoError(null));
    const buffer = new Uint8Array(Buffer.from(action.payload, 'utf-8'));
    yield call(dataLayer.saveFile, {
      path: SCENE_INFO_FILE,
      content: buffer,
    });
    yield put(setSceneInfoContent(action.payload));
  } catch (e) {
    yield put(setSceneInfoError('Failed to save scene description'));
  } finally {
    yield put(setSceneInfoLoading(false));
  }
}
