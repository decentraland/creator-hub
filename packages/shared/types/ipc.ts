export interface Ipc {
  'electron.getHome': () => string;
  'cli.init': (name: string) => void;
  'cli.preview': (path: string) => void;
  'cli.publish': (path: string) => void;
}
