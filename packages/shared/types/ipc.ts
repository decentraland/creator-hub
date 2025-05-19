import type { OpenDialogOptions } from 'electron';

import type { Outdated } from '/shared/types/npm';
import type { PreviewOptions } from './settings';

export type DeployOptions = { path: string; target?: string; targetContent?: string };
export type IpcResult<T> = {
  success: true;
  value: T;
};
export type IpcError = {
  success: false;
  error: string;
};

export interface Ipc {
  'electron.getUserDataPath': () => string;
  'electron.getAppVersion': () => Promise<string>;
  'electron.getDownloadedVersion': () => Promise<string | null>;
  'electron.getUpdateInfo': () => Promise<{
    updateAvailable: boolean;
    error?: any;
    version: string | null;
  }>;
  'electron.getWorkspaceConfigPath': (path: string) => Promise<string>;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'electron.copyToClipboard': (text: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'inspector.openSceneDebugger': (path: string) => Promise<string>;
  'inspector.attachSceneDebugger': (path: string, eventName: string) => Promise<boolean>;
  'bin.install': () => Promise<void>;
  'bin.code': (path: string) => Promise<void>;
  'cli.init': (path: string, repo?: string) => Promise<void>;
  'cli.start': (path: string, opts: PreviewOptions) => Promise<string>;
  'cli.deploy': (opts: DeployOptions) => Promise<number>;
  'cli.killPreview': (path: string) => Promise<void>;
  'analytics.track': (event: string, data?: Record<string, any>) => void;
  'analytics.identify': (userId: string, traits?: Record<string, any>) => void;
  'analytics.getAnonymousId': () => Promise<string>;
  'analytics.getProjectId': (path: string) => Promise<string>;
  'npm.install': (path: string, packages?: string[]) => Promise<void>;
  'npm.getOutdatedDeps': (path: string, packages?: string[]) => Promise<Outdated>;
}
