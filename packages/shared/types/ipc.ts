export interface Ipc {
  'electron.getHome': () => string;
  'cli.init': (path: string, repo?: string) => void;
  'cli.preview': (path: string) => void;
  'cli.publish': (path: string) => void;
}
