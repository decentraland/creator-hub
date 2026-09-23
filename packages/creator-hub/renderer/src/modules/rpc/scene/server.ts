import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { fs, editor, consoleWindow } from '#preload';

import { type Project } from '/shared/types/projects';
import { getPath } from '../';
import type { Severity } from '../../store/snackbar/types';
import { store } from '../../store';
import { actions as aiActions } from '../../store/ai';
import { actions as snackbarActions } from '../../store/snackbar';
import { createGenericNotification } from '../../store/snackbar/utils';
import { actions as workspaceActions } from '../../store/workspace';
import { actions as optimizerActions } from '../../store/optimizer';

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
  SET_UI_DESIGNER_MODE = 'set_ui_designer_mode',
  OPTIMIZE_SCENE = 'optimize_scene',
  PROMPT_ASSISTANT = 'prompt_assistant',
  SET_CONSOLE_WINDOW_OPEN = 'set_console_window_open',
  NOTIFY_SCENE_METADATA = 'notify_scene_metadata',
}

export type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: { cmd: string; args: Record<string, unknown> };
  [Method.GET_FEATURE_FLAGS]: Record<string, never>;
  [Method.UPDATE_SDK]: Record<string, never>;
  [Method.SET_UI_DESIGNER_MODE]: { open: boolean };
  [Method.OPTIMIZE_SCENE]: Record<string, never>;
  [Method.PROMPT_ASSISTANT]: { text: string };
  [Method.SET_CONSOLE_WINDOW_OPEN]: { open: boolean };
  [Method.NOTIFY_SCENE_METADATA]: { title: string };
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
  [Method.SET_UI_DESIGNER_MODE]: void;
  [Method.OPTIMIZE_SCENE]: void;
  [Method.PROMPT_ASSISTANT]: void;
  [Method.SET_CONSOLE_WINDOW_OPEN]: void;
  [Method.NOTIFY_SCENE_METADATA]: void;
};

export class SceneRpcServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, project: Project) {
    super('SceneRpcOutbound', transport);

    // The header title used to refresh from the scene.json write passing through the storage
    // RPC. Under a WebSocket data-layer (Bevy) that write happens in the realm's process, so
    // the inspector reports the title itself as it is edited.
    this.handle('notify_scene_metadata', async ({ title }) => {
      const current = store.getState().editor.project ?? project;
      if (!title || current.title === title) return;
      store.dispatch(workspaceActions.updateProject({ ...current, title }));
    });

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

    // Opens the model-optimization modal (rendered by EditorPage) for this scene. The
    // heavy work runs in the CH main process — the inspector only triggers the UI here.
    this.handle('optimize_scene', async () => {
      store.dispatch(optimizerActions.open());
    });

    this.handle('prompt_assistant', async ({ text }) => {
      if (typeof text !== 'string' || text.trim() === '') return;
      if (store.getState().workspace.settings?.aiAssistant !== true) {
        store.dispatch(
          snackbarActions.pushSnackbar(
            createGenericNotification(
              'info',
              'Turn on the AI assistant in Settings → AI to describe what a Trigger Area does.',
            ),
          ),
        );
        return;
      }
      store.dispatch(aiActions.setDraftPrompt(text));
    });

    // The console's pop-out / dock-back controls live inside the inspector iframe (#1272).
    // Opening the detached console window is a host concern, so the inspector asks for it here.
    this.handle('set_console_window_open', async ({ open }) => {
      if (typeof open !== 'boolean') return;
      try {
        if (open) {
          const locale = store.getState().translation.locale;
          await consoleWindow.openConsoleWindow(project.path, locale);
        } else {
          await consoleWindow.closeConsoleWindow();
        }
      } catch (error) {
        console.error('[SceneRpc] Failed to toggle the detached console window', error);
      }
    });

    this.handle('set_ui_designer_mode', async ({ open }) => {
      if (typeof open !== 'boolean') return;
      try {
        await store.dispatch(
          workspaceActions.updateProjectInfo({
            path: project.path,
            info: { uiDesignerOpen: open },
          }),
        );
      } catch (error) {
        console.error('[SceneRpc] Failed to persist the UI designer mode', error);
      }
    });
  }
}
