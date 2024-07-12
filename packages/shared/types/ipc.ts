import { type OpenDialogOptions } from 'electron';
export interface Ipc {
  'electron.getAppHome': () => string;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'cli.init': (path: string, repo?: string) => Promise<void>;
  'cli.start': (path: string) => Promise<void>;
  'cli.deploy': (path: string) => Promise<void>;
}
