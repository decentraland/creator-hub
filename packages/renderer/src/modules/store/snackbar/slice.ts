import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { actions as workspaceActions } from '../workspace';
import { createCustomNotification, createGenericNotification } from './utils';
import type { Notification } from './types';
import { t } from '../translation/utils';

// state
export type SnackbarState = {
  notifications: Notification[];
};

export const initialState: SnackbarState = {
  notifications: [createGenericNotification('success', 'Testing notification!')],
};

// slice
export const slice = createSlice({
  name: 'snackbar',
  initialState,
  reducers: {
    removeSnackbar: (state, { payload: id }: PayloadAction<Notification['id']>) => {
      state.notifications = state.notifications.filter($ => $.id !== id);
      state.notifications.push(createGenericNotification('success', t('modal.confirm')));
    },
  },
  extraReducers: builder => {
    builder.addCase(workspaceActions.getWorkspace.fulfilled, (state, action) => {
      if (action.payload.missing.length > 0) {
        state.notifications.push(createCustomNotification('missing-scenes'));
      }
    });
  },
  selectors: {},
});

// exports
export const actions = { ...slice.actions };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
