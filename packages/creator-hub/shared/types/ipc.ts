import type { OpenDialogOptions } from 'electron';

import type { Outdated } from '/shared/types/npm';
import type { Events } from '/shared/types/analytics';
import type { DeployOptions } from '/shared/types/deploy';

import type { PreviewOptions, ReleaseNotes } from './settings';
import type { Config, EditorConfig } from './config';

export type IpcResult<T> = {
  success: true;
  value: T;
};
export type IpcError = {
  success: false;
  error: {
    message: string;
    name: string;
  };
};

export interface Ipc {
  'electron.getUserDataPath': () => string;
  'electron.getAppVersion': () => Promise<string>;
  'electron.getEnvOverride': () => 'dev' | 'prod' | null;
  'updater.getDownloadedVersion': () => string | null;
  'updater.setupUpdaterEvents': () => void;
  'updater.checkForUpdates': (config?: { autoDownload?: boolean }) => Promise<{
    updateAvailable: boolean;
    error?: any;
    version: string | null;
  }>;
  'updater.downloadProgress': (progress: number) => void;
  'updater.quitAndInstall': (version: string) => Promise<void>;
  'updater.getInstalledVersion': () => Promise<string | undefined>;
  'updater.deleteVersionFile': () => Promise<void>;
  'updater.downloadUpdate': () => Promise<any>;
  'updater.getReleaseNotes': (version: string) => Promise<ReleaseNotes | undefined>;
  'electron.getWorkspaceConfigPath': (path: string) => Promise<string>;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'electron.copyToClipboard': (text: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'inspector.openSceneDebugger': (path: string) => Promise<string>;
  'inspector.attachSceneDebugger': (path: string, eventName: string) => Promise<boolean>;
  'config.getConfig': () => Promise<Config>;
  'config.writeConfig': (config: Config) => Promise<void>;
  'bin.install': () => Promise<void>;

  'code.open': (path: string) => Promise<void>;
  'code.getEditors': () => Promise<EditorConfig[]>;
  'code.addEditor': (path: string) => Promise<EditorConfig[]>;
  'code.setDefaultEditor': (path: string) => Promise<EditorConfig[]>;
  'code.removeEditor': (path: string) => Promise<EditorConfig[]>;

  'cli.init': (path: string, repo: string) => Promise<void>;
  'cli.start': (path: string, opts: PreviewOptions) => Promise<string>;
  'cli.deploy': (opts: DeployOptions) => Promise<number>;
  'cli.killPreview': (path: string) => Promise<void>;
  'analytics.track': <T extends keyof Events>(event: T, data?: Events[T]) => void;
  'analytics.identify': (userId: string, traits?: Record<string, any>) => void;
  'analytics.getAnonymousId': () => Promise<string>;
  'analytics.getProjectId': (path: string) => Promise<string>;
  'npm.install': (path: string, packages?: string[]) => Promise<void>;
  'npm.getOutdatedDeps': (path: string, packages?: string[]) => Promise<Outdated>;
  'npm.getContextFiles': (path: string) => Promise<void>;
}
