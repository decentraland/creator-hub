import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { fs, editor } from '#preload';

import { type Project } from '/shared/types/projects';
import { getPath } from '../';
import type { Severity } from '../../store/snackbar/types';
import { store } from '../../store';
import { actions as snackbarActions } from '../../store/snackbar';
import { createGenericNotification } from '../../store/snackbar/utils';
import { actions as workspaceActions } from '../../store/workspace';

type NotificationRequest = {
  severity: Severity;
  message: string;
  // 0 = persistent + closeable; omit for the default auto-hide.
  duration?: number;
  // Secondary detail; a notification with a description renders closeable.
  description?: string;
};

export enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  BROADCAST_MOBILE_DEBUG_COMMAND = 'broadcast_mobile_debug_command',
  GET_FEATURE_FLAGS = 'get_feature_flags',
  UPDATE_SDK = 'update_sdk',
}

export type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: { cmd: string; args: Record<string, unknown> };
  [Method.GET_FEATURE_FLAGS]: Record<string, never>;
  [Method.UPDATE_SDK]: Record<string, never>;
};

export type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: {
    ok: boolean;
    results: { sessionId: number; ok: boolean; data: unknown }[];
  };
  [Method.GET_FEATURE_FLAGS]: { flags: Record<string, boolean> };
  [Method.UPDATE_SDK]: { ok: boolean };
};

export class SceneRpcServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, project: Project) {
    super('SceneRpcOutbound', transport);

    this.handle('open_file', async ({ path }) => {
      const resolvedPath = await getPath(path, project);
      await editor.openCode(resolvedPath);
    });

    this.handle('open_directory', async ({ path, createIfNotExists }) => {
      const resolvedPath = await getPath(path, project);
      const isDir = await fs.isDirectory(resolvedPath);

      if (!isDir) {
        if (createIfNotExists) {
          console.info(`Path "${resolvedPath}" does not exist, creating...`);
          await fs.mkdir(resolvedPath);
        } else {
          console.error(`Path "${resolvedPath}" is not a directory`);
          return;
        }
      }

      await fs.showItemInFolder(resolvedPath);
    });

    this.handle('push_notification', async ({ notification }) => {
      store.dispatch(
        snackbarActions.pushSnackbar(
          createGenericNotification(notification.severity, notification.message, {
            duration: notification.duration,
            description: notification.description,
          }),
        ),
      );
    });

    this.handle('broadcast_mobile_debug_command', async ({ cmd, args }) => {
      return editor.broadcastMobileDebugCommand(cmd, args);
    });

    // The inspector pulls flags once its scene server is ready — the initial push
    // (setFeatureFlags) can land before a slow-booting renderer's server exists.
    this.handle('get_feature_flags', async () => {
      return { flags: store.getState().featureFlags.flags };
    });

    this.handle('update_sdk', async () => {
      const state = store.getState();
      if (state.editor.isInstallingProject) {
        return { ok: false };
      }
      const currentProject = state.editor.project ?? project;
      try {
        await store.dispatch(workspaceActions.updatePackages(currentProject)).unwrap();
        await store
          .dispatch(workspaceActions.fetchSdkCommandsVersion(currentProject.path))
          .unwrap();
        return { ok: true };
      } catch (error) {
        console.error('[SceneRpc] Failed to update the scene SDK', error);
        return { ok: false };
      }
    });
  }
}
