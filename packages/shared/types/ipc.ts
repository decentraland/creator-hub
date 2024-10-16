import { type OpenDialogOptions } from 'electron';

export type DeployOptions = { path: string; target?: string; targetContent?: string };

export interface Ipc {
  'electron.getAppHome': () => string;
  'electron.getAppVersion': () => Promise<string>;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'bin.install': () => Promise<void>;
  'bin.code': (path: string) => Promise<void>;
  'cli.init': (path: string, repo?: string) => Promise<void>;
  'cli.start': (path: string) => Promise<void>;
  'cli.deploy': (opts: DeployOptions) => Promise<number>;
  'analytics.track': (event: string, data?: Record<string, any>) => void;
  'analytics.identify': (userId: string, traits?: Record<string, any>) => void;
  'analytics.getAnonymousId': () => Promise<string>;
  'npm.install': (path: string, packageName?: string) => Promise<void>;
  'npm.packageOutdated': (path: string, packageName: string) => Promise<boolean>;
}
