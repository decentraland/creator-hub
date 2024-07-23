import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { t } from '/@/modules/store/translation/utils';

import { actions as workspaceActions } from '../workspace';
import { createCustomNotification, createGenericNotification } from './utils';
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
    builder
      .addCase(workspaceActions.getWorkspace.fulfilled, (state, action) => {
        if (action.payload.missing.length > 0) {
          state.notifications.push(createCustomNotification('missing-scenes'));
        }
      })
      .addCase(workspaceActions.importProject.pending, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications.push(
          createGenericNotification('loading', t('snackbar.generic.import_scene'), {
            duration: 0,
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.importProject.fulfilled, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
      })
      .addCase(workspaceActions.importProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.import_scene_failed'), {
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.duplicateProject.pending, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications.push(
          createGenericNotification('loading', t('snackbar.generic.duplicate_scene'), {
            duration: 0,
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.duplicateProject.fulfilled, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
      })
      .addCase(workspaceActions.duplicateProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.duplicate_scene_failed'), {
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.deleteProject.pending, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications.push(
          createGenericNotification('loading', t('snackbar.generic.delete_scene'), {
            duration: 0,
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.deleteProject.fulfilled, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
      })
      .addCase(workspaceActions.deleteProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.delete_scene_failed'), {
            requestId,
          }),
        );
      });
  },
  selectors: {},
});

// exports
export const actions = { ...slice.actions };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };