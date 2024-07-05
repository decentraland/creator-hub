import { ipcRenderer } from 'electron';

async function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args);
}

export const ipc = {
  app: {
    getPath: (name: string) => invoke<string>('app.getPath', name),
  },
  cli: {
    preview: () => invoke<void>('cli.preview'),
  },
};
