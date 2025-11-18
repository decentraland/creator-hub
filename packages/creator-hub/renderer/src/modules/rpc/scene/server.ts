import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { fs, editor, workspace } from '#preload';

import { type Project } from '/shared/types/projects';
import { hasCustomCode } from '/shared/scene-parser';
import { getPath } from '../';
import type { Severity } from '../../store/snackbar/types';
import { store } from '../../store';
import { actions as snackbarActions } from '../../store/snackbar';
import { createGenericNotification } from '../../store/snackbar/utils';

type NotificationRequest = {
  severity: Severity;
  message: string;
};

export enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  GET_SCENE_CUSTOM_CODE = 'get_scene_custom_code',
}

export type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.GET_SCENE_CUSTOM_CODE]: Record<string, never>;
};

export type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.GET_SCENE_CUSTOM_CODE]: boolean;
};

export class SceneRpcServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, project: Project) {
    super('SceneRpcOutbound', transport);

    this.handle('open_file', async ({ path }) => {
      const resolvedPath = await getPath(path, project);
      await editor.openCode(resolvedPath);
    });

    this.handle('open_directory', async ({ path }) => {
      const resolvedPath = await getPath(path, project);
      const isDir = await fs.isDirectory(resolvedPath);
      if (isDir) {
        await fs.openPath(resolvedPath);
      } else {
        console.error(`Path ${resolvedPath} is not a directory`);
      }
    });

    this.handle('push_notification', async ({ notification }) => {
      store.dispatch(
        snackbarActions.pushSnackbar(
          createGenericNotification(notification.severity, notification.message),
        ),
      );
    });

    this.handle('get_scene_custom_code', async () => {
      try {
        const content = await workspace.getSceneSourceFile(project.path);
        return hasCustomCode(content);
      } catch (error) {
        console.error('Failed to get scene custom code:', error);
        return false; // Default to false on error
      }
    });
  }
}
