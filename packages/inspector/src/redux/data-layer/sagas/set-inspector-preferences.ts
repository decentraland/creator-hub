import { call, put, select } from 'redux-saga/effects';

import type { IDataLayer, setInspectorPreferences } from '..';
import { ErrorType, error, getDataLayerInterface } from '..';
import { updatePreferences, selectInspectorPreferences } from '../../app';
import type { InspectorPreferences } from '../../../lib/logic/preferences/types';
import { getDefaultInspectorPreferences } from '../../../lib/logic/preferences/types';

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
    yield call(dataLayer.setInspectorPreferences, newPreferences);
    yield put(updatePreferences({ preferences: newPreferences }));
  } catch (e) {
    yield put(error({ error: ErrorType.SetPreferences }));
  }
}
