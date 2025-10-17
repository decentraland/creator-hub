import { call, put } from 'redux-saga/effects';

import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';
import { getSceneInfoContent, SCENE_INFO_FILE, toggleInfoPanel } from '../';
import type { GetFileResponse, InspectorUIStateMessage } from '../../../tooling-entrypoint';

export function* initializeSceneInfoPanelSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    // Check if scene info .md file exists
    const response: GetFileResponse = yield call(dataLayer.getFile, {
      path: SCENE_INFO_FILE,
    });
    const hasContent = response && response.content && response.content.length > 0;

    // Get saved UI state from component
    const uiState: InspectorUIStateMessage = yield call(dataLayer.getInspectorUIState, {});
    const shouldBeVisible = uiState.sceneInfoPanelVisible ?? true; // If sceneInfoPanelVisible is undefined (never set), default to true (open)

    const shouldOpen = hasContent && shouldBeVisible;
    yield put(toggleInfoPanel(shouldOpen));
    yield put(getSceneInfoContent());
  } catch (e) {
    yield put(toggleInfoPanel(false));
  }
}
