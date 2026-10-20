import { call, put } from 'redux-saga/effects';

import type { IDataLayer, removeAssets } from '..';
import { ErrorType, error, getAssetCatalog, getDataLayerInterface, clearRemoveAssets } from '..';
import { removeAssetFilesSettled } from '../../../lib/data-layer/remove-assets';

export function* removeAssetsSaga(action: ReturnType<typeof removeAssets>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const { removed, error: failure }: Awaited<ReturnType<typeof removeAssetFilesSettled>> =
      yield call(removeAssetFilesSettled, dataLayer, action.payload.paths);
    if (failure) {
      console.error('Failed to remove assets:', failure);
      const errorType = removed.length ? ErrorType.PartialRemoveAsset : ErrorType.RemoveAsset;
      yield put(error({ error: errorType }));
    }
  } finally {
    yield put(getAssetCatalog());
    yield put(clearRemoveAssets(action.payload));
  }
}
