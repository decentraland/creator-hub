import type { OpenDialogOptions } from 'electron';

import type { Outdated } from '/shared/types/npm';
import type { Events } from '/shared/types/analytics';
import type { DeployOptions } from '/shared/types/deploy';

import type { PreviewOptions, ReleaseNotes } from './settings';
import type { Config, EditorConfig } from './config';
import type { Env } from './env';

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

export interface MobileDebugSessionInfo {
  id: number;
  sessionId: string | null;
  deviceName: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  status: 'active' | 'ended';
  messageCount: number;
}

export interface Ipc {
  'electron.getEnvOverride': () => Env | null;
  'electron.getUserDataPath': () => string;
  'electron.getAppVersion': () => Promise<string>;
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
  'inspector.attachSceneDebugger': (path: string) => Promise<string>;
  'inspector.detachSceneDebugger': (path: string) => void;
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
  'cli.getMobilePreview': (path: string) => Promise<{ url: string; qr: string } | null>;
  'analytics.track': <T extends keyof Events>(event: T, data?: Events[T]) => void;
  'analytics.identify': (userId: string, traits?: Record<string, any>) => void;
  'analytics.getAnonymousId': () => Promise<string>;
  'analytics.getProjectId': (path: string) => Promise<string>;
  'npm.install': (path: string, packages?: string[]) => Promise<void>;
  'npm.getOutdatedDeps': (path: string, packages?: string[]) => Promise<Outdated>;
  'npm.getContextFiles': (path: string) => Promise<void>;
  'mobileDebug.getSessions': () => Promise<MobileDebugSessionInfo[]>;
  'mobileDebug.getConsoleEntries': (afterIndex: number) => Promise<{
    entries: { sessionId: number; timestamp: number; level: 'log' | 'error'; message: string }[];
    nextIndex: number;
  }>;
  'mobileDebug.getRawEntries': (
    afterIndex: number,
  ) => Promise<{ entries: unknown[]; nextIndex: number }>;
  'mobileDebug.getMonitorStats': () => Promise<{
    totalEntries: number;
    totalCrdt: number;
    totalOpCalls: number;
    totalConsoleLogs: number;
    activeSessions: number;
    entriesPerSecond: number;
  }>;
  'mobileDebug.clear': () => Promise<void>;
  'mobileDebug.sendCommand': (
    sessionId: number,
    cmd: string,
    args: Record<string, unknown>,
  ) => Promise<{ ok: boolean; data: unknown }>;
  'mobileDebug.broadcastCommand': (
    cmd: string,
    args: Record<string, unknown>,
  ) => Promise<{ ok: boolean; data: unknown }>;
  'mobileDebug.startServer': () => Promise<{ port: number }>;
  'mobileDebug.stopServer': () => Promise<void>;
  'mobileDebug.getServerStatus': () => Promise<{
    running: boolean;
    port: number | null;
    sessions: number;
  }>;
  'mobileDebug.getStandaloneDeeplink': () => Promise<{
    url: string;
    qr: string;
    port: number;
  }>;
}
