import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { actions as workspaceActions } from '../workspace';
import { createCustomNotification } from './utils';
import type { Notification } from './types';

// state
export type SnackbarState = {
  notifications: Notification[];
};

export const initialState: SnackbarState = {
  notifications: [],
};

// slice
export const slice = createSlice({
  name: 'snackbar',
  initialState,
  reducers: {
    removeSnackbar: (state, { payload: id }: PayloadAction<Notification['id']>) => {
      state.notifications = state.notifications.filter($ => $.id !== id);
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
