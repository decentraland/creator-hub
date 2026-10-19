import { call, put } from 'redux-saga/effects';

import type { IDataLayer, removeAssets } from '..';
import { ErrorType, error, getAssetCatalog, getDataLayerInterface, clearRemoveAssets } from '..';
import { removeAssetFiles } from '../../../lib/data-layer/remove-assets';

export function* removeAssetsSaga(action: ReturnType<typeof removeAssets>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    yield call(removeAssetFiles, dataLayer, action.payload.paths);
    yield put(getAssetCatalog());
  } catch (e) {
    yield put(error({ error: ErrorType.RemoveAsset }));
  } finally {
    yield put(clearRemoveAssets(action.payload));
  }
}
