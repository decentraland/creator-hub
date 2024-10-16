import { ipcMain } from 'electron';
import log from 'electron-log';
import type { Ipc } from '/shared/types/ipc';

// wrapper for ipcMain.handle with types
export async function handle<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      log.info(
        `[IPC] channel=${channel} ${args
          .map((arg, idx) => `args[${idx}]=${JSON.stringify(arg)}`)
          .join(' ')}`.trim(),
      );
      const result = await handler(event, ...(args as Parameters<Ipc[T]>));
      return result;
    } catch (error: any) {
      log.error(`[IPC] channel=${channel} error=${error.message}`);
      throw error;
    }
  });
}
