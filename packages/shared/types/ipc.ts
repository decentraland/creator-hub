export interface Ipc {
  'electron.getHome': () => string;
  'cli.init': (path: string, repo?: string) => void;
  'cli.start': (path: string) => void;
  'cli.deploy': (path: string) => void;
}
