import { call, put } from 'redux-saga/effects';

import type { IDataLayer, removeAssets } from '..';
import { ErrorType, error, getAssetCatalog, getDataLayerInterface, clearRemoveAssets } from '..';
import type { RemovalResult } from '../../../lib/data-layer/remove-assets';
import { removeAssetFiles, removeEmptyFolders } from '../../../lib/data-layer/remove-assets';
import { getStorage } from '../../../lib/data-layer/client/storage';
import type { Storage } from '../../../lib/logic/storage/types';

export function* removeAssetsSaga(action: ReturnType<typeof removeAssets>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const { removed, error: failure }: RemovalResult = yield call(
      removeAssetFiles,
      dataLayer,
      action.payload.paths,
    );
    if (failure) {
      console.error('Failed to remove assets:', failure);
      const errorType = removed.length ? ErrorType.PartialRemoveAsset : ErrorType.RemoveAsset;
      yield put(error({ error: errorType }));
    }
    const storage: Storage | undefined = yield call(getStorage);
    if (storage && action.payload.folders?.length) {
      yield call(removeEmptyFolders, storage, action.payload.folders);
    }
  } finally {
    yield put(getAssetCatalog());
    yield put(clearRemoveAssets(action.payload));
  }
}
