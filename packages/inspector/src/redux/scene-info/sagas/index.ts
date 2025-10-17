import { takeEvery } from 'redux-saga/effects';
import {
  getSceneInfoContent,
  saveSceneInfoContent,
  initializeSceneInfoPanel,
  toggleInfoPanel,
} from '../';
import { getSceneInfoContentSaga } from './get-content';
import { saveSceneInfoContentSaga } from './save-content';
import { initializeSceneInfoPanelSaga } from './initialize-panel';
import { toggleInfoPanelSaga } from './toggle-panel';

export function* sceneInfoSaga() {
  yield takeEvery(getSceneInfoContent.type, getSceneInfoContentSaga);
  yield takeEvery(saveSceneInfoContent.type, saveSceneInfoContentSaga);
  yield takeEvery(initializeSceneInfoPanel.type, initializeSceneInfoPanelSaga);
  yield takeEvery(toggleInfoPanel.type, toggleInfoPanelSaga);
}
