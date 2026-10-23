import { call, put } from 'redux-saga/effects';

import type { IDataLayer, saveAnimatedThumbnail, saveThumbnail } from '..';
import { ErrorType, error, getDataLayerInterface } from '..';
import { upsertThumbnail } from '../../app';
import type { Empty, SaveFileRequest } from '../../../lib/data-layer/remote-data-layer';
import { getThumbnailHashNameForAsset } from '../../../lib/utils/hash';
import { DIRECTORY } from '../../../lib/data-layer/host/fs-utils';

function* saveThumbnailFile(request: SaveFileRequest, extension: 'png' | 'webp') {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const hashedFileName: string = yield call(
      getThumbnailHashNameForAsset,
      request.path,
      extension,
    );
    const path = `${DIRECTORY.THUMBNAILS}/${hashedFileName}`;

    const _response: Empty = yield call(dataLayer.saveFile, { ...request, path });

    yield put(upsertThumbnail({ path, content: request.content }));
  } catch (e) {
    yield put(error({ error: ErrorType.SaveThumbnail }));
  }
}

export function* saveThumbnailSaga(action: ReturnType<typeof saveThumbnail>) {
  yield call(saveThumbnailFile, action.payload, 'png');
}

export function* saveAnimatedThumbnailSaga(action: ReturnType<typeof saveAnimatedThumbnail>) {
  yield call(saveThumbnailFile, action.payload, 'webp');
}
