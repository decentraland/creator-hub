import type { Events } from '/shared/types/analytics';
import type { Project } from '/shared/types/projects';
import type { DeployOptions } from '/shared/types/deploy';
import type { WorldSettings } from '/@/lib/worlds';
import type { AddressPermissionPayload, ParcelsPermissionPayload } from '../management/types';
import { type GetState } from '#store';

import { actions as workspaceActions } from '../workspace';
import { actions as editorActions } from '../editor';
import { actions as managementActions } from '../management';

type ActionWithPayload<P, M = void> = {
  type: string;
  payload: P;
  meta: { arg: M };
};

type AnalyticsHandler<T, E extends keyof Events = keyof Events> = {
  eventName: E;
  getPayload: (action: T, getState: GetState) => Events[E];
};

export const analyticsConfig: Record<string, AnalyticsHandler<any>> = {
  [workspaceActions.createProject.fulfilled.type]: {
    eventName: 'Create Project',
    getPayload: (action: ActionWithPayload<Project>): Events['Create Project'] => ({
      project_id: action.payload.id,
      project_name: action.payload.title,
      template: action.payload.description || '',
      rows: action.payload.layout.rows,
      cols: action.payload.layout.cols,
    }),
  },
  [workspaceActions.runProject.fulfilled.type]: {
    eventName: 'Open Project',
    getPayload: (action: ActionWithPayload<Project>): Events['Open Project'] => ({
      project_id: action.payload.id,
      project_name: action.payload.title,
    }),
  },
  [workspaceActions.updateProject.type]: {
    eventName: 'Save Project Success',
    getPayload: (action: ActionWithPayload<Project>): Events['Save Project Success'] => ({
      project_id: action.payload.id,
      project_name: action.payload.title,
    }),
  },
  [editorActions.runScene.pending.type]: {
    eventName: 'Preview Scene',
    getPayload: (_action: ActionWithPayload<void>, getState: GetState): Events['Preview Scene'] => {
      const projectId = getState().editor.project?.id;
      if (!projectId) throw new Error('No project ID found when trying to preview scene');
      return {
        project_id: projectId,
      };
    },
  },
  [editorActions.publishScene.fulfilled.type]: {
    eventName: 'Publish Scene',
    getPayload: (
      action: ActionWithPayload<void, DeployOptions>,
      getState: GetState,
    ): Events['Publish Scene'] => {
      const projectId = getState().editor.project?.id;
      if (!projectId) throw new Error('No project ID found when trying to publish scene');
      return {
        project_id: projectId,
        target: action.meta.arg.target || 'unknown',
        targetContent: action.meta.arg.targetContent || 'unknown',
      };
    },
  },
  [managementActions.addAddressPermission.fulfilled.type]: {
    eventName: 'Add World Permissions',
    getPayload: (
      action: ActionWithPayload<void, AddressPermissionPayload>,
    ): Events['Add World Permissions'] => ({
      world_name: action.meta.arg.worldName,
      wallet_address: action.meta.arg.walletAddress,
      permission_name: action.meta.arg.permissionName,
    }),
  },
  [managementActions.removeAddressPermission.fulfilled.type]: {
    eventName: 'Remove World Permissions',
    getPayload: (
      action: ActionWithPayload<void, AddressPermissionPayload>,
    ): Events['Remove World Permissions'] => ({
      world_name: action.meta.arg.worldName,
      wallet_address: action.meta.arg.walletAddress,
      permission_name: action.meta.arg.permissionName,
    }),
  },
  [managementActions.addParcelsPermission.fulfilled.type]: {
    eventName: 'Add Collaborator Parcel Permissions',
    getPayload: (
      action: ActionWithPayload<void, ParcelsPermissionPayload>,
    ): Events['Add Collaborator Parcel Permissions'] => ({
      world_name: action.meta.arg.worldName,
      wallet_address: action.meta.arg.walletAddress,
      permission_name: action.meta.arg.permissionName,
      parcels_count: action.meta.arg.parcels.length,
    }),
  },
  [managementActions.removeParcelsPermission.fulfilled.type]: {
    eventName: 'Remove Collaborator Parcel Permissions',
    getPayload: (
      action: ActionWithPayload<void, ParcelsPermissionPayload>,
    ): Events['Remove Collaborator Parcel Permissions'] => ({
      world_name: action.meta.arg.worldName,
      wallet_address: action.meta.arg.walletAddress,
      permission_name: action.meta.arg.permissionName,
      parcels_count: action.meta.arg.parcels.length,
    }),
  },
  [managementActions.updateWorldSettings.fulfilled.type]: {
    eventName: 'Update World Settings',
    getPayload: (
      action: ActionWithPayload<void, { worldName: string; worldSettings: Partial<WorldSettings> }>,
      getState: GetState,
    ): Events['Update World Settings'] => {
      const { worldName, worldSettings: changedSettings } = action.meta.arg;
      const state = getState();
      const previousSettings =
        state.management.worldSettings.worldName === worldName
          ? state.management.worldSettings.settings
          : {};

      return {
        world_name: worldName,
        world_settings: { ...previousSettings, ...changedSettings },
        changed_fields: {
          title: changedSettings.title !== undefined,
          description: changedSettings.description !== undefined,
          thumbnail: changedSettings.thumbnail !== undefined,
          content_rating: changedSettings.contentRating !== undefined,
          categories: changedSettings.categories !== undefined,
        },
        scenes_list:
          state.management.worldSettings.worldName === worldName
            ? state.management.worldSettings.scenes.map(scene => ({
                entityId: scene.entityId,
                deployer: scene.deployer,
                parcels_count: scene.parcels?.length || 0,
                size: scene.size,
                created_at: scene.createdAt,
              }))
            : [],
      };
    },
  },
  [managementActions.unpublishWorldScene.fulfilled.type]: {
    eventName: 'Unpublish World Scene',
    getPayload: (
      action: ActionWithPayload<void, { worldName: string; sceneCoord: string }>,
    ): Events['Unpublish World Scene'] => ({
      world_name: action.meta.arg.worldName,
      scene_coord: action.meta.arg.sceneCoord,
    }),
  },
  [managementActions.unpublishEntireWorld.fulfilled.type]: {
    eventName: 'Unpublish Entire World',
    getPayload: (
      action: ActionWithPayload<void, { worldName: string }>,
    ): Events['Unpublish Entire World'] => ({
      world_name: action.meta.arg.worldName,
    }),
  },
};
