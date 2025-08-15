import type { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select } from 'redux-saga/effects';
import type { IDataLayer } from '..';
import { getAssetCatalog, getDataLayerInterface } from '..';
import { error } from '../index';
import { ErrorType } from '../index';

export function* renameCustomAssetSaga(
  action: PayloadAction<{ assetId: string; newName: string }>,
) {
  try {
    const dataLayer: IDataLayer = yield select(getDataLayerInterface);
    if (!dataLayer) return;

    yield call([dataLayer, 'renameCustomAsset'], {
      assetId: action.payload.assetId,
      newName: action.payload.newName,
    });
    yield put(getAssetCatalog());
  } catch (e) {
    yield put(error({ error: ErrorType.RenameCustomAsset }));
    console.error(e);
  }
}
