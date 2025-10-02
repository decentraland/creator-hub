import { call, put } from 'redux-saga/effects';

import type { IDataLayer, saveThumbnail } from '..';
import { ErrorType, error, getDataLayerInterface, getThumbnails } from '..';
import type { Empty, SaveFileRequest } from '../../../lib/data-layer/remote-data-layer';
import { getThumbnailHashNameForAsset } from '../../../lib/utils/hash';
import { DIRECTORY } from '../../../lib/data-layer/host/fs-utils';

export function* saveThumbnailSaga(action: ReturnType<typeof saveThumbnail>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const hashedFileName: string = yield call(
      getThumbnailHashNameForAsset,
      action.payload.assetPath,
    );
    const dataLayerPayload: SaveFileRequest = {
      content: action.payload.content,
      path: `${DIRECTORY.THUMBNAILS}/${hashedFileName}`,
    };

    const _response: Empty = yield call(dataLayer.saveFile, dataLayerPayload);

    // Fetch thumbnails again
    yield put(getThumbnails());
  } catch (e) {
    yield put(error({ error: ErrorType.SaveThumbnail }));
  }
}
