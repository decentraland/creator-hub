import { put } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { togglePanel } from '../../ui';
import { PanelName } from '../../ui/types';
import { EditorComponentNames } from '../../../lib/sdk/components/types';

export function* toggleInfoPanelSaga(action: PayloadAction<boolean>) {
  // Toggle the panel in UI
  const isPanelEnabled = action.payload;
  yield put(togglePanel({ panel: PanelName.SCENE_INFO, enabled: isPanelEnabled }));

  // Update InspectorUIState component directly - it will be auto-persisted to composite
  const engine = (globalThis as any).dataLayerEngine;
  if (engine) {
    const InspectorUIState = engine.getComponentOrNull(EditorComponentNames.InspectorUIState);
    if (InspectorUIState) {
      InspectorUIState.createOrReplace(engine.RootEntity, {
        sceneInfoPanelVisible: isPanelEnabled,
      });

      // Trigger engine update to sync the component change via CRDT
      yield engine.update(1);
    }
  }
}
