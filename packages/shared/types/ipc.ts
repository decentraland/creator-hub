import { type OpenDialogOptions } from 'electron';
import type { Config } from '/shared/types/config';

export type DeployOptions = { path: string; target?: string; targetContent?: string };

export interface Ipc {
  'electron.getAppHome': () => string;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'cli.init': (path: string, repo?: string) => Promise<void>;
  'cli.start': (path: string) => Promise<number>;
  'cli.deploy': (opts: DeployOptions) => Promise<number>;
  'config.get': () => Promise<Config>;
  'config.write': (config: Config) => Promise<void>;
}
