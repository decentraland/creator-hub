import { call } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { IDataLayer } from '..';
import { getDataLayerInterface } from '..';

export function* openFileSaga(action: PayloadAction<{ path: string }>) {
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  if (!dataLayer) return;

  try {
    yield call(dataLayer.openFile, { path: action.payload.path });
  } catch (e) {
    console.error('Failed to open file in editor:', e);
  }
}
