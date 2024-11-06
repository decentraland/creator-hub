import { ipcMain } from 'electron';
import log from 'electron-log';
import type { Ipc, IpcError, IpcResult } from '/shared/types/ipc';

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
      const value = await handler(event, ...(args as Parameters<Ipc[T]>));
      const result: IpcResult<typeof value> = {
        success: true,
        value,
      };
      return result;
    } catch (error: any) {
      log.error(`[IPC] channel=${channel} error=${error.message}`);
      const result: IpcError = {
        success: false,
        error: error.message,
      };
      return result;
    }
  });
}
