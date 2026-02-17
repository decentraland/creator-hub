import type { Events } from '/shared/types/analytics';
import type { Project } from '/shared/types/projects';
import type { DeployOptions } from '/shared/types/deploy';
import type { AddressPermissionPayload, ParcelsPermissionPayload } from '../management/types';
import { type GetState } from '#store';

import { actions as workspaceActions } from '../workspace';
import { actions as editorActions } from '../editor';
import { actions as managementActions } from '../management';

type ActionWithPayload<P> = {
  type: string;
  payload: P;
};

type ActionFulfilled<P = void, M = void> = {
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
      action: ActionFulfilled<void, DeployOptions>,
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
      action: ActionFulfilled<void, AddressPermissionPayload>,
    ): Events['Add World Permissions'] => {
      const { worldName, permissionName, walletAddress } = action.meta.arg;

      return {
        world_name: worldName,
        wallet_address: walletAddress,
        permission_name: permissionName,
      };
    },
  },
  [managementActions.removeAddressPermission.fulfilled.type]: {
    eventName: 'Remove World Permissions',
    getPayload: (
      action: ActionFulfilled<void, AddressPermissionPayload>,
    ): Events['Remove World Permissions'] => {
      const { worldName, permissionName, walletAddress } = action.meta.arg;

      return {
        world_name: worldName,
        wallet_address: walletAddress,
        permission_name: permissionName,
      };
    },
  },
  [managementActions.addParcelsPermission.fulfilled.type]: {
    eventName: 'Add Collaborator Parcel Permissions',
    getPayload: (
      action: ActionFulfilled<void, ParcelsPermissionPayload>,
    ): Events['Add Collaborator Parcel Permissions'] => {
      const { worldName, permissionName, walletAddress, parcels } = action.meta.arg;

      return {
        world_name: worldName,
        wallet_address: walletAddress,
        permission_name: permissionName,
        parcels_count: parcels.length,
      };
    },
  },
  [managementActions.removeParcelsPermission.fulfilled.type]: {
    eventName: 'Remove Collaborator Parcel Permissions',
    getPayload: (
      action: ActionFulfilled<void, ParcelsPermissionPayload>,
    ): Events['Remove Collaborator Parcel Permissions'] => {
      const { worldName, permissionName, walletAddress, parcels } = action.meta.arg;

      return {
        world_name: worldName,
        wallet_address: walletAddress,
        permission_name: permissionName,
        parcels_count: parcels.length,
      };
    },
  },
};
