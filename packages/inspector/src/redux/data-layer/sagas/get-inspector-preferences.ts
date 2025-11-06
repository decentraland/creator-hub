import { call, put } from 'redux-saga/effects';

import type { IDataLayer } from '../';
import { ErrorType, error, getDataLayerInterface } from '../';
import { updatePreferences } from '../../app';
import type { InspectorPreferences } from '../../../lib/logic/preferences/types';
import { cameraModeFromProto } from '../../../lib/logic/preferences/types';
import type { InspectorPreferencesMessage } from '../../../lib/data-layer/proto/gen/data-layer.gen';

export function* getInspectorPreferencesSaga() {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;
  try {
    const protoPreferences: InspectorPreferencesMessage = yield call(
      dataLayer.getInspectorPreferences,
      {},
    );
    // Convert proto message to internal preferences
    const preferences: InspectorPreferences = {
      cameraMode: cameraModeFromProto(protoPreferences.cameraMode),
      freeCameraInvertRotation: protoPreferences.freeCameraInvertRotation,
      autosaveEnabled: protoPreferences.autosaveEnabled,
    };
    yield put(updatePreferences({ preferences }));
  } catch (e) {
    yield put(error({ error: ErrorType.GetPreferences }));
  }
}
