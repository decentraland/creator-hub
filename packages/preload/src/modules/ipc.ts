import {ipcRenderer} from 'electron';

async function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args);
}

export const ipc = {
  path: {
    getHome: () => invoke<string>('path.getHome'),
  },
};
