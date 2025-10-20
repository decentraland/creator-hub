import { call, put } from 'redux-saga/effects';

import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';
import { getSceneInfoContent, SCENE_INFO_FILE, toggleInfoPanel } from '../';
import type { GetFileResponse } from '../../../tooling-entrypoint';
import { EditorComponentNames } from '../../../lib/sdk/components/types';

export function* initializeSceneInfoPanelSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    // Check if scene info .md file exists
    const response: GetFileResponse = yield call(dataLayer.getFile, {
      path: SCENE_INFO_FILE,
    });

    const hasContent = response && response.content && response.content.length > 0;
    if (hasContent) {
      // Read InspectorUIState component value directly from engine
      // The engine is exposed globally for debugging
      const engine = (globalThis as any).dataLayerEngine;
      if (engine) {
        const InspectorUIState = engine.getComponentOrNull(EditorComponentNames.InspectorUIState);

        let shouldOpen = false;
        if (InspectorUIState && InspectorUIState.has(engine.RootEntity)) {
          const state = InspectorUIState.get(engine.RootEntity);
          // If sceneInfoPanelVisible is undefined (old scenes), default to false (closed)
          // For new scenes, it will be explicitly set to true
          shouldOpen = state.sceneInfoPanelVisible ?? false;
        }

        yield put(toggleInfoPanel(shouldOpen));
      }
    } else {
      yield put(toggleInfoPanel(false));
    }

    yield put(getSceneInfoContent());
  } catch (e) {
    yield put(toggleInfoPanel(false));
  }
}
