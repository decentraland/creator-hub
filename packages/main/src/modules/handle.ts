import { ipcMain } from 'electron';
import log from 'electron-log';
import type { Ipc } from '/shared/types/ipc';

// wrapper for ipcMain.handle with types
export async function handle<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    log.info(`IPC: ${channel}`, ...args);
    return handler(event, ...(args as Parameters<Ipc[T]>));
  });
}
