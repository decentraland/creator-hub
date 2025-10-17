import { call } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getStorage } from '../../../lib/data-layer/client/iframe-data-layer';

export function* openFileSaga(action: PayloadAction<{ path: string }>) {
  const storage = getStorage();
  if (!storage) return;

  try {
    yield call([storage, storage.openFile], action.payload.path);
  } catch (e) {
    console.error('Failed to open file in editor:', e);
  }
}
