import { takeEvery } from 'redux-saga/effects';
import { getSceneInfoContent, saveSceneInfoContent } from '../';
import { getSceneInfoContentSaga } from './get-content';
import { saveSceneInfoContentSaga } from './save-content';

export function* sceneInfoSaga() {
  yield takeEvery(getSceneInfoContent.type, getSceneInfoContentSaga);
  yield takeEvery(saveSceneInfoContent.type, saveSceneInfoContentSaga);
}
