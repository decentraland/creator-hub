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
import { removeAssetFilesSettled } from '../../../lib/data-layer/remove-assets';
import { removeAssetsSaga } from './remove-assets';

describe('removeAssetsSaga', () => {
  const paths = ['assets/a.glb', 'assets/b.glb'];
  const action = removeAssets({ paths });
  const dataLayer = {} as IDataLayer;
  const run = (result: { removed: string[]; error?: unknown }) =>
    expectSaga(removeAssetsSaga, action).provide([
      [matchers.call.fn(getDataLayerInterface), dataLayer],
      [matchers.call.fn(removeAssetFilesSettled), result],
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
});
