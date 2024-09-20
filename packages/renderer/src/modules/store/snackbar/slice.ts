import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { t } from '/@/modules/store/translation/utils';

import { actions as workspaceActions } from '../workspace';
import {
  createCustomNotification,
  createDependencyNotification,
  createGenericNotification,
} from './utils';
import type {
  CustomNotification,
  DependencyNotification,
  Notification,
  Opts,
  Severity,
} from './types';

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
    removeSnackbar: (
      state,
      {
        payload,
      }: PayloadAction<{ id: Notification['id']; project?: DependencyNotification['project'] }>,
    ) => {
      state.notifications = state.notifications.filter($ => $.id !== payload.id);
    },
    createGenericNotification: (
      state,
      action: PayloadAction<{ severity: Severity; message: string; opts?: Opts }>,
    ) => {
      state.notifications.push(
        createGenericNotification(
          action.payload.severity,
          action.payload.message,
          action.payload.opts,
        ),
      );
    },
    createCustomNotification: (
      state,
      action: PayloadAction<{ type: CustomNotification['type']; opts?: Opts }>,
    ) => {
      state.notifications.push(createCustomNotification(action.payload.type, action.payload.opts));
    },
    createDependencyNotification: (
      state,
      action: PayloadAction<{
        type: DependencyNotification['type'];
        project: DependencyNotification['project'];
        opts?: Opts;
      }>,
    ) => {
      // TODO: Fix showing duplicate notifications for the same type and project
      if (
        !state.notifications.some(
          $ => $.type === action.payload.type && $.project.id === action.payload.project.id,
        )
      ) {
        state.notifications.push(
          createDependencyNotification(
            action.payload.type,
            action.payload.project,
            action.payload.opts,
          ),
        );
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(workspaceActions.getWorkspace.fulfilled, (state, action) => {
        if (action.payload.missing.length > 0) {
          state.notifications.push(createCustomNotification('missing-scenes', { duration: 0 }));
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
