import { takeEvery, takeLatest } from 'redux-saga/effects';

import {
  connect,
  connected,
  getInspectorPreferences,
  setInspectorPreferences,
  reconnect,
  save,
  getAssetCatalog,
  importAsset,
  removeAsset,
  getThumbnails,
  saveThumbnail,
  createCustomAsset,
  deleteCustomAsset,
  renameCustomAsset,
} from '..';
import {
  getSceneInfoContent,
  saveSceneInfoContent,
  initializeSceneInfoPanel,
  toggleInfoPanel,
} from '../../scene-info';
import { getSceneInfoContentSaga } from '../../scene-info/sagas/get-content';
import { saveSceneInfoContentSaga } from '../../scene-info/sagas/save-content';
import { initializeSceneInfoPanelSaga } from '../../scene-info/sagas/initialize-panel';
import { toggleInfoPanelSaga } from '../../scene-info/sagas/toggle-panel';
import { connectSaga } from './connect';
import { reconnectSaga } from './reconnect';
import { saveSaga } from './save';
import { getInspectorPreferencesSaga } from './get-inspector-preferences';
import { setInspectorPreferencesSaga } from './set-inspector-preferences';
import { getAssetCatalogSaga } from './get-asset-catalog';
import { undoRedoSaga } from './undo-redo';
import { importAssetSaga } from './import-asset';
import { removeAssetSaga } from './remove-asset';
import { connectedSaga } from './connected';
import { getThumbnailsSaga } from './get-thumbnails';
import { saveThumbnailSaga } from './save-thumbnail';
import { createCustomAssetSaga } from './create-custom-asset';
import { deleteCustomAssetSaga } from './delete-custom-asset';
import { renameCustomAssetSaga } from './rename-custom-asset';

export function* dataLayerSaga() {
  yield takeEvery(connect.type, connectSaga);
  yield takeEvery(reconnect.type, reconnectSaga);
  yield takeEvery(connected.type, connectedSaga);
  yield takeEvery(save.type, saveSaga);
  yield takeEvery(getInspectorPreferences.type, getInspectorPreferencesSaga);
  yield takeEvery(setInspectorPreferences.type, setInspectorPreferencesSaga);
  yield takeEvery(getAssetCatalog.type, getAssetCatalogSaga);
  yield undoRedoSaga();
  yield takeEvery(importAsset.type, importAssetSaga);
  yield takeEvery(removeAsset.type, removeAssetSaga);
  yield takeEvery(getThumbnails.type, getThumbnailsSaga);
  yield takeEvery(saveThumbnail.type, saveThumbnailSaga);
  yield takeEvery(createCustomAsset.type, createCustomAssetSaga);
  yield takeLatest(deleteCustomAsset.type, deleteCustomAssetSaga);
  yield takeEvery(renameCustomAsset.type, renameCustomAssetSaga);
  yield takeEvery(getSceneInfoContent.type, getSceneInfoContentSaga);
  yield takeEvery(saveSceneInfoContent.type, saveSceneInfoContentSaga);
  yield takeEvery(initializeSceneInfoPanel.type, initializeSceneInfoPanelSaga);
  yield takeEvery(toggleInfoPanel.type, toggleInfoPanelSaga);
}

export default dataLayerSaga;
