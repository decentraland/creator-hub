import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { fs, editor, consoleWindow, misc } from '#preload';

import { type Project } from '/shared/types/projects';
import type { AiAssetMention } from '/shared/types/ai';
import { getPath } from '../';
import type { Severity } from '../../store/snackbar/types';
import { store } from '../../store';
import { actions as aiActions } from '../../store/ai';
import { actions as snackbarActions } from '../../store/snackbar';
import { createGenericNotification } from '../../store/snackbar/utils';
import { actions as workspaceActions } from '../../store/workspace';
import { actions as optimizerActions } from '../../store/optimizer';
import { resolveProfiles, sanitizeProfileAddresses, type ProfileSummary } from './profiles';

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
  INSTALL_MULTIPLAYER = 'install_multiplayer',
  UNINSTALL_MULTIPLAYER = 'uninstall_multiplayer',
  GET_PROFILES = 'get_profiles',
  OPTIMIZE_SCENE = 'optimize_scene',
  PROMPT_ASSISTANT = 'prompt_assistant',
  MENTION_ASSET = 'mention_asset',
  COPY_TO_CLIPBOARD = 'copy_to_clipboard',
  SET_CONSOLE_WINDOW_OPEN = 'set_console_window_open',
  NOTIFY_SCENE_METADATA = 'notify_scene_metadata',
  NOTIFY_READY = 'notify_ready',
}

export type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: { cmd: string; args: Record<string, unknown> };
  [Method.GET_FEATURE_FLAGS]: Record<string, never>;
  [Method.UPDATE_SDK]: Record<string, never>;
  [Method.SET_UI_DESIGNER_MODE]: { open: boolean };
  [Method.INSTALL_MULTIPLAYER]: Record<string, never>;
  [Method.UNINSTALL_MULTIPLAYER]: Record<string, never>;
  [Method.GET_PROFILES]: { addresses: string[] };
  [Method.OPTIMIZE_SCENE]: Record<string, never>;
  [Method.PROMPT_ASSISTANT]: { text: string };
  [Method.MENTION_ASSET]: AiAssetMention;
  [Method.COPY_TO_CLIPBOARD]: { text: string };
  [Method.SET_CONSOLE_WINDOW_OPEN]: { open: boolean };
  [Method.NOTIFY_SCENE_METADATA]: { title: string; scene?: Project['scene'] };
  [Method.NOTIFY_READY]: Record<string, never>;
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
  [Method.INSTALL_MULTIPLAYER]: { ok: boolean };
  [Method.UNINSTALL_MULTIPLAYER]: { ok: boolean };
  [Method.GET_PROFILES]: { profiles: ProfileSummary[] };
  [Method.OPTIMIZE_SCENE]: void;
  [Method.PROMPT_ASSISTANT]: void;
  [Method.MENTION_ASSET]: void;
  [Method.COPY_TO_CLIPBOARD]: void;
  [Method.SET_CONSOLE_WINDOW_OPEN]: void;
  [Method.NOTIFY_SCENE_METADATA]: void;
  [Method.NOTIFY_READY]: void;
};

export type SceneRpcServerCallbacks = {
  // The inspector's scene RPC server is up and can take pushes (fires again for every
  // reloaded iframe).
  onReady?: () => void;
};

/** Identifies a layout regardless of the order its parcels are listed in. */
const layoutKey = (scene: { base: string; parcels: string[] } | undefined) =>
  scene ? `${scene.base}|${[...scene.parcels].sort().join(';')}` : undefined;

export class SceneRpcServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, project: Project, callbacks: SceneRpcServerCallbacks = {}) {
    super('SceneRpcOutbound', transport);

    this.handle('notify_ready', async () => {
      callbacks.onReady?.();
    });

    // The layout the editor reported last, seeded with the one it opened with. A notice
    // repeats it whenever only the title changed, and taking it again would undo parcels
    // picked meanwhile in the publish dialog (an editor that could not take them still
    // holds its old layout).
    let lastEditorLayout = layoutKey(project.scene);
    this.handle('notify_scene_metadata', async ({ title, scene }) => {
      const current = store.getState().editor.project ?? project;
      const layout = scene && layoutKey(scene);
      const layoutChanged = !!layout && layout !== lastEditorLayout;
      if (layout) lastEditorLayout = layout;
      store.dispatch(
        workspaceActions.updateProject({
          ...current,
          title: title || current.title,
          scene: layoutChanged ? scene : current.scene,
        }),
      );
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

    const swapSdk = async (
      thunk:
        | typeof workspaceActions.installMultiplayerSdk
        | typeof workspaceActions.uninstallMultiplayerSdk,
      failure: string,
    ) => {
      const state = store.getState();
      if (state.editor.isInstallingProject) {
        return { ok: false };
      }
      const currentProject = state.editor.project ?? project;
      try {
        await store.dispatch(thunk(currentProject)).unwrap();
        await store
          .dispatch(workspaceActions.fetchSdkCommandsVersion(currentProject.path))
          .unwrap();
        return { ok: true };
      } catch (error) {
        console.error(`[SceneRpc] ${failure}`, error);
        return { ok: false };
      }
    };

    this.handle('install_multiplayer', () =>
      swapSdk(workspaceActions.installMultiplayerSdk, 'Failed to install the multiplayer SDK'),
    );

    this.handle('uninstall_multiplayer', () =>
      swapSdk(workspaceActions.uninstallMultiplayerSdk, 'Failed to restore the latest SDK release'),
    );

    this.handle('get_profiles', async ({ addresses }) => {
      const requested = sanitizeProfileAddresses(addresses);
      if (requested.length === 0) return { profiles: [] };
      try {
        return { profiles: await resolveProfiles(store, requested) };
      } catch (error) {
        console.error('[SceneRpc] Failed to resolve profiles', error);
        return { profiles: requested.map(address => ({ address })) };
      }
    });

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

    // A double-click on a Local Assets entry. Only lands while the chat is visible (the reducer
    // gates on it), so it never opens the assistant on its own.
    this.handle('mention_asset', async mention => {
      const isText = (value: unknown) => typeof value === 'string' && value.trim() !== '';
      if ('path' in mention && isText(mention.path)) {
        store.dispatch(aiActions.addAssetMention({ path: mention.path }));
      } else if ('builtInEmote' in mention && isText(mention.builtInEmote)) {
        store.dispatch(aiActions.addAssetMention({ builtInEmote: mention.builtInEmote }));
      }
    });

    // Electron denies navigator.clipboard to the inspector iframe, so it copies through here.
    this.handle('copy_to_clipboard', async ({ text }) => {
      if (typeof text !== 'string') return;
      await misc.copyToClipboard(text);
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
