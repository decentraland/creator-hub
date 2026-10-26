import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';
import type { IDataLayer } from '..';
import { getAssetCatalog, getDataLayerInterface } from '..';
import { redoSaga, undoSaga } from './undo-redo';

describe('undo/redo sagas', () => {
  const dataLayer = (type: string) =>
    ({
      undo: vi.fn().mockResolvedValue({ type }),
      redo: vi.fn().mockResolvedValue({ type }),
      getUndoRedoState: vi.fn().mockResolvedValue({ canUndo: true, canRedo: true }),
    }) as unknown as IDataLayer;

  describe('when the undone step changed files together with the scene', () => {
    it('should reload the asset catalog after an undo', () =>
      expectSaga(undoSaga)
        .provide([[matchers.call.fn(getDataLayerInterface), dataLayer('composite')]])
        .put(getAssetCatalog())
        .run());

    it('should reload the asset catalog after a redo', () =>
      expectSaga(redoSaga)
        .provide([[matchers.call.fn(getDataLayerInterface), dataLayer('composite')]])
        .put(getAssetCatalog())
        .run());
  });

  describe('when the undone step only changed the scene', () => {
    it('should not reload the asset catalog', () =>
      expectSaga(undoSaga)
        .provide([[matchers.call.fn(getDataLayerInterface), dataLayer('crdt')]])
        .not.put(getAssetCatalog())
        .run());
  });
});
