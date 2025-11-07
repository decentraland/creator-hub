import { call, put, select } from 'redux-saga/effects';

import type { IDataLayer, setInspectorPreferences } from '..';
import { ErrorType, error, getDataLayerInterface } from '..';
import { updatePreferences, selectInspectorPreferences } from '../../app';
import type { InspectorPreferences } from '../../../lib/logic/preferences/types';
import {
  getDefaultInspectorPreferences,
  cameraModeToProto,
} from '../../../lib/logic/preferences/types';
import type { InspectorPreferencesMessage } from '../../../lib/data-layer/proto/gen/data-layer.gen';

export function* setInspectorPreferencesSaga(action: ReturnType<typeof setInspectorPreferences>) {
  const values = action.payload;
  const inspectorPreferences: InspectorPreferences | undefined = yield select(
    selectInspectorPreferences,
  );
  const newPreferences: InspectorPreferences = {
    ...getDefaultInspectorPreferences(),
    ...inspectorPreferences,
    ...values,
  };
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);

  if (!dataLayer) return;

  try {
    // Convert internal preferences to proto message
    const protoMessage: InspectorPreferencesMessage = {
      cameraMode: cameraModeToProto(newPreferences.cameraMode),
      freeCameraInvertRotation: newPreferences.freeCameraInvertRotation,
      autosaveEnabled: newPreferences.autosaveEnabled,
    };
    yield call(dataLayer.setInspectorPreferences, protoMessage);
    yield put(updatePreferences({ preferences: newPreferences }));
  } catch (e) {
    yield put(error({ error: ErrorType.SetPreferences }));
  }
}
