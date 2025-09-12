import { call, put, takeEvery } from 'redux-saga/effects';

import type { IDataLayer } from '..';
import {
  ErrorType,
  error,
  getAssetCatalog,
  getDataLayerInterface,
  updateUndoRedoState,
  connected,
  undo,
  redo,
  refreshUndoRedoState,
} from '..';
import type { UndoRedoResponse } from '../../../lib/data-layer/remote-data-layer';
import { updateCanSave } from '../../app';

function* updateUndoRedoAvailability(): Generator<any, void, any> {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    const state: any = yield call((dataLayer as any).getUndoRedoState, {});
    if (state) {
      yield put(
        updateUndoRedoState({
          canUndo: state.canUndo,
          canRedo: state.canRedo,
        }),
      );
    }
  } catch (error) {
    console.warn('Could not get undo/redo state:', error);
  }
}

export function* undoSaga(): Generator<any, void, any> {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const response: UndoRedoResponse = yield call(dataLayer.undo, {});

    if (response.type === 'file') {
      yield put(getAssetCatalog());
    }

    yield put(updateCanSave({ dirty: true }));

    yield call(updateUndoRedoAvailability);
  } catch (e) {
    yield put(error({ error: ErrorType.Undo }));
  }
}

export function* redoSaga(): Generator<any, void, any> {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const response: UndoRedoResponse = yield call(dataLayer.redo, {});

    if (response.type === 'file') {
      yield put(getAssetCatalog());
    }

    yield put(updateCanSave({ dirty: true }));

    yield call(updateUndoRedoAvailability);
  } catch (e) {
    yield put(error({ error: ErrorType.Redo }));
  }
}

export function* initializeUndoRedoStateSaga(): Generator<any, void, any> {
  yield call(updateUndoRedoAvailability);
}

export function* undoRedoSaga(): Generator<any, void, any> {
  yield takeEvery(undo.type, undoSaga);
  yield takeEvery(redo.type, redoSaga);
  yield takeEvery(connected.type, initializeUndoRedoStateSaga);
  yield takeEvery(refreshUndoRedoState.type, updateUndoRedoAvailability);
}
