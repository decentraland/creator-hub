import type { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select } from 'redux-saga/effects';
import type { IDataLayer } from '..';
import { getAssetCatalog, getDataLayerInterface } from '..';
import { error } from '../index';
import { ErrorType } from '../index';

export function* deleteCustomAssetSaga(action: PayloadAction<{ assetId: string }>) {
  try {
    const dataLayer: IDataLayer = yield select(getDataLayerInterface);
    if (!dataLayer) return;

    yield call([dataLayer, 'deleteCustomAsset'], { assetId: action.payload.assetId });
    yield put(getAssetCatalog());
  } catch (e) {
    yield put(error({ error: ErrorType.DeleteCustomAsset }));
    console.error(e);
  }
}
