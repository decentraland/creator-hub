import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { isProjectError } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';

import { actions as workspaceActions } from '../workspace';
import { actions as deploymentActions } from '../deployment';
import { actions as managementActions } from '../management';
import { actions as ensActions } from '../ens';
import { actions as landActions } from '../land';
import { shouldNotifyUpdates } from '../workspace/utils';
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
    pushSnackbar: (state, { payload: notification }: PayloadAction<Notification>) => {
      state.notifications = state.notifications.filter($ => $.id !== notification.id);
      state.notifications.push(notification);
    },
    removeSnackbar: (state, { payload: id }: PayloadAction<Notification['id']>) => {
      state.notifications = state.notifications.filter($ => $.id !== id);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(workspaceActions.getWorkspace.fulfilled, (state, action) => {
        if (action.payload.missing.length > 0) {
          state.notifications.push(
            createCustomNotification({ type: 'missing-scenes' }, { duration: 0 }),
          );
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

      .addCase(workspaceActions.getAvailable.rejected, (state, payload) => {
        const isPathError = isProjectError(payload.payload, 'INVALID_PATH');
        const translatedError = isPathError
          ? t('snackbar.generic.invalid_scenes_folder')
          : t('snackbar.generic.create_scene_failed');
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', translatedError, {
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.createProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.create_scene_failed'), {
            requestId,
          }),
        );
      })
      .addCase(workspaceActions.installProject.pending, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications.push(
          createGenericNotification('loading', t('snackbar.generic.installing_dependencies'), {
            requestId,
            duration: 0,
          }),
        );
      })
      .addCase(workspaceActions.installProject.fulfilled, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
      })
      .addCase(workspaceActions.installProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.installing_dependencies_failed'), {
            requestId,
            duration: 2_000,
          }),
        );
      })
      .addCase(workspaceActions.runProject.rejected, (state, payload) => {
        const { requestId } = payload.meta;
        state.notifications = state.notifications.filter($ => $.id !== requestId);
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.run_scene_failed'), {
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
      })
      .addCase(workspaceActions.moveProjectToMissing, state => {
        const oldMissingScenesNotification = state.notifications.find(
          $ => $.type === 'missing-scenes',
        );
        if (!oldMissingScenesNotification) {
          state.notifications.push(
            createCustomNotification({ type: 'missing-scenes' }, { duration: 0 }),
          );
        }
      })
      .addCase(workspaceActions.updatePackages.fulfilled, state => {
        state.notifications = state.notifications.filter($ => $.requestId !== 'updatePackages');
        state.notifications.push(
          createGenericNotification('success', t('snackbar.generic.dependencies_updated'), {
            requestId: 'updatePackages',
          }),
        );
      })
      .addCase(
        workspaceActions.updateAvailableDependencyUpdates.fulfilled,
        (state, { meta, payload: { project, strategy } }) => {
          state.notifications = state.notifications.filter(
            $ => $.type !== 'new-dependency-version',
          );
          if (shouldNotifyUpdates(strategy, project.dependencyAvailableUpdates)) {
            state.notifications.push(
              createCustomNotification(
                { type: 'new-dependency-version', project },
                { duration: 0, requestId: meta.requestId },
              ),
            );
          }
        },
      )
      .addCase(deploymentActions.executeDeployment.pending, (state, action) => {
        const path = action.meta.arg;
        state.notifications = state.notifications.filter($ => $.requestId !== path);
        state.notifications.push(
          createCustomNotification({ type: 'deploy', path }, { duration: 0, requestId: path }),
        );
      })
      .addCase(deploymentActions.executeDeployment.fulfilled, (state, action) => {
        const path = action.meta.arg;
        state.notifications = state.notifications.filter($ => $.requestId !== path);
        state.notifications.push(
          createCustomNotification({ type: 'deploy', path }, { duration: 0, requestId: path }),
        );
      })
      .addCase(deploymentActions.executeDeployment.rejected, (state, action) => {
        const path = action.meta.arg;
        state.notifications = state.notifications.filter($ => $.requestId !== path);
        state.notifications.push(
          createCustomNotification({ type: 'deploy', path }, { duration: 0, requestId: path }),
        );
      })
      .addCase(ensActions.fetchENSList.rejected, state => {
        state.notifications = state.notifications.filter($ => $.requestId !== 'fetchENSList');
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_ens_list_failed'), {
            duration: 5000,
            requestId: 'fetchENSList',
          }),
        );
      })
      .addCase(landActions.fetchLandList.rejected, state => {
        state.notifications = state.notifications.filter($ => $.requestId !== 'fetchLandList');
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_land_list_failed'), {
            duration: 5000,
            requestId: 'fetchLandList',
          }),
        );
      })
      .addCase(managementActions.fetchManagedProjects.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'fetchManagedProjects',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_managed_projects_failed'), {
            duration: 5000,
            requestId: 'fetchManagedProjects',
          }),
        );
      })
      .addCase(managementActions.fetchWorldSettings.rejected, state => {
        state.notifications = state.notifications.filter($ => $.requestId !== 'fetchWorldSettings');
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_world_settings_failed'), {
            duration: 5000,
            requestId: 'fetchWorldSettings',
          }),
        );
      })
      .addCase(managementActions.updateWorldSettings.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'updateWorldSettings',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.update_world_settings_failed'), {
            duration: 5000,
            requestId: 'updateWorldSettings',
          }),
        );
      })
      .addCase(managementActions.fetchWorldScenes.rejected, state => {
        state.notifications = state.notifications.filter($ => $.requestId !== 'fetchWorldScenes');
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_world_scenes_failed'), {
            duration: 5000,
            requestId: 'fetchWorldScenes',
          }),
        );
      })
      .addCase(managementActions.fetchWorldPermissions.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'fetchWorldPermissions',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.fetch_world_permissions_failed'), {
            duration: 5000,
            requestId: 'fetchWorldPermissions',
          }),
        );
      })
      .addCase(managementActions.updateWorldPermissions.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'updateWorldPermissions',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.update_permissions_failed'), {
            duration: 5000,
            requestId: 'updateWorldPermissions',
          }),
        );
      })
      .addCase(managementActions.addAddressPermission.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'addAddressPermission',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.add_permission_failed'), {
            duration: 5000,
            requestId: 'addAddressPermission',
          }),
        );
      })
      .addCase(managementActions.removeAddressPermission.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'removeAddressPermission',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.remove_permission_failed'), {
            duration: 5000,
            requestId: 'removeAddressPermission',
          }),
        );
      })
      .addCase(managementActions.fetchParcelsPermission.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'fetchParcelsPermission',
        );
        state.notifications.push(
          createGenericNotification(
            'error',
            t('snackbar.generic.fetch_parcels_permission_failed'),
            {
              duration: 5000,
              requestId: 'fetchParcelsPermission',
            },
          ),
        );
      })
      .addCase(managementActions.addParcelsPermission.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'addParcelsPermission',
        );
        state.notifications.push(
          createGenericNotification('error', t('snackbar.generic.add_parcels_permission_failed'), {
            duration: 5000,
            requestId: 'addParcelsPermission',
          }),
        );
      })
      .addCase(managementActions.removeParcelsPermission.rejected, state => {
        state.notifications = state.notifications.filter(
          $ => $.requestId !== 'removeParcelsPermission',
        );
        state.notifications.push(
          createGenericNotification(
            'error',
            t('snackbar.generic.remove_parcels_permission_failed'),
            {
              duration: 5000,
              requestId: 'removeParcelsPermission',
            },
          ),
        );
      });
  },
});

// exports
export const actions = { ...slice.actions };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
