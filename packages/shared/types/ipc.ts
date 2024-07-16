import { type OpenDialogOptions } from 'electron';
export interface Ipc {
  'electron.getAppHome': () => string;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'cli.init': (path: string, repo?: string) => Promise<void>;
  'cli.start': (path: string) => Promise<number>;
  'cli.deploy': (path: string) => Promise<number>;
}
