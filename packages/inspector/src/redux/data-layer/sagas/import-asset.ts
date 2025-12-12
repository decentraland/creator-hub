import { call, put, actionChannel, take } from 'redux-saga/effects';
import type { ActionPattern } from 'redux-saga/effects';

import type { IDataLayer, importAsset } from '..';
import { ErrorType, error, getAssetCatalog, getDataLayerInterface } from '..';
import type { Empty } from '../../../lib/data-layer/remote-data-layer';

function* processImportAsset(action: ReturnType<typeof importAsset>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const _response: Empty = yield call(dataLayer.importAsset, action.payload);

    // Refresh catalog after each import
    // takeLatest on getAssetCatalog ensures only the last one executes
    yield put(getAssetCatalog());
  } catch (e) {
    console.error('[Import Asset] Error importing asset:', e);
    yield put(error({ error: ErrorType.ImportAsset }));
  }
}

export function* importAssetSaga(importAssetActionType: ActionPattern): any {
  // Create a channel that buffers all importAsset actions
  const channel = yield actionChannel(importAssetActionType);

  while (true) {
    // Take one action at a time from the channel
    const action: ReturnType<typeof importAsset> = yield take(channel);

    // Process the import sequentially
    yield call(processImportAsset, action);
  }
}
