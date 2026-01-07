import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { fs, editor, scene } from '#preload';

import { type Project } from '/shared/types/projects';
import { getPath } from '../';
import type { Severity } from '../../store/snackbar/types';
import { store } from '../../store';
import { actions as snackbarActions } from '../../store/snackbar';
import { createGenericNotification } from '../../store/snackbar/utils';
import type { EntityData } from '/shared/types/ipc';

type NotificationRequest = {
  severity: Severity;
  message: string;
};

export enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  EXPORT_SCENE_GLTF = 'export_scene_gltf',
  GET_SCENE_ENTITIES = 'get_scene_entities',
}

export type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.EXPORT_SCENE_GLTF]: { entities: EntityData[] };
  [Method.GET_SCENE_ENTITIES]: Record<string, never>;
};

export type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.EXPORT_SCENE_GLTF]: { success: boolean; filePath?: string; error?: string };
  [Method.GET_SCENE_ENTITIES]: { entities: EntityData[] };
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

      await fs.openPath(resolvedPath);
    });

    this.handle('push_notification', async ({ notification }) => {
      store.dispatch(
        snackbarActions.pushSnackbar(
          createGenericNotification(notification.severity, notification.message),
        ),
      );
    });

    this.handle('export_scene_gltf', async ({ entities }) => {
      try {
        const result = await scene.exportSceneAsGltf({
          projectPath: project.path,
          entities,
        });

        if (result.success) {
          store.dispatch(
            snackbarActions.pushSnackbar(
              createGenericNotification('success', `Scene exported successfully to ${result.filePath}`),
            ),
          );
        } else {
          store.dispatch(
            snackbarActions.pushSnackbar(
              createGenericNotification('error', `Export failed: ${result.error}`),
            ),
          );
        }

        return result;
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        store.dispatch(
          snackbarActions.pushSnackbar(
            createGenericNotification('error', `Export failed: ${errorMessage}`),
          ),
        );
        return {
          success: false,
          error: errorMessage,
        };
      }
    });

    this.handle('get_scene_entities', async () => {
      // This will be responded to by the Inspector
      // We're setting up the handler but the actual data comes from Inspector
      return { entities: [] };
    });
  }
}
