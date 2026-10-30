import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';
import type { IDataLayer } from '..';
import {
  ErrorType,
  clearRemoveAssets,
  error,
  getAssetCatalog,
  getDataLayerInterface,
  removeAssets,
} from '..';
import type { RemovalResult } from '../../../lib/data-layer/remove-assets';
import { removeAssetFiles, removeEmptyFolders } from '../../../lib/data-layer/remove-assets';
import { getStorage } from '../../../lib/data-layer/client/storage';
import type { Storage } from '../../../lib/logic/storage/types';
import { removeAssetsSaga } from './remove-assets';

describe('removeAssetsSaga', () => {
  const paths = ['assets/a.glb', 'assets/b.glb'];
  const action = removeAssets({ paths });
  const dataLayer = {} as IDataLayer;
  const run = (result: Omit<RemovalResult, 'batched'>) =>
    expectSaga(removeAssetsSaga, action).provide([
      [matchers.call.fn(getDataLayerInterface), dataLayer],
      [matchers.call.fn(removeAssetFiles), { ...result, batched: true }],
    ]);

  describe('when every file is removed', () => {
    it('should reload the asset catalog without reporting an error', () =>
      run({ removed: paths })
        .put(getAssetCatalog())
        .put(clearRemoveAssets({ paths }))
        .not.put.actionType(error.type)
        .run());
  });

  describe('when only some files are removed', () => {
    it('should reload the asset catalog and report a partial removal', () =>
      run({ removed: ['assets/a.glb'], error: new Error('EBUSY') })
        .put(getAssetCatalog())
        .put(error({ error: ErrorType.PartialRemoveAsset }))
        .put(clearRemoveAssets({ paths }))
        .run());
  });

  describe('when nothing is removed', () => {
    it('should reload the asset catalog and report the failure', () =>
      run({ removed: [], error: new Error('EACCES') })
        .put(getAssetCatalog())
        .put(error({ error: ErrorType.RemoveAsset }))
        .put(clearRemoveAssets({ paths }))
        .run());
  });

  describe('when the removal includes folders', () => {
    const folders = ['assets/props'];
    const folderAction = removeAssets({ paths, folders });
    const storage = {} as Storage;
    const runWithStorage = (provided: Storage | undefined) =>
      expectSaga(removeAssetsSaga, folderAction).provide([
        [matchers.call.fn(getDataLayerInterface), dataLayer],
        [matchers.call.fn(removeAssetFiles), { removed: paths, batched: true }],
        [matchers.call.fn(getStorage), provided],
        [matchers.call.fn(removeEmptyFolders), undefined],
      ]);

    describe('and the editor storage is available', () => {
      it('should remove the folders left empty before reloading the asset catalog', () =>
        runWithStorage(storage)
          .call(removeEmptyFolders, storage, folders)
          .put(getAssetCatalog())
          .run());
    });

    describe('and there is no editor storage', () => {
      it('should not try to remove the folders', () =>
        runWithStorage(undefined).not.call.fn(removeEmptyFolders).run());
    });
  });
});
