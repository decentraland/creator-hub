import { ipcMain } from 'electron';
import log from 'electron-log';
import * as Sentry from '@sentry/electron/main';

import type { Ipc, IpcError, IpcResult } from '/shared/types/ipc';
import { StreamError } from './bin';

// wrapper for ipcMain.handle with types
export async function handle<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      log.info(
        `[IPC] channel=${channel} ${args.map((arg, idx) => `args[${idx}]=${JSON.stringify(arg)}`).join(' ')}`.trim(),
      );
      const value = await handler(event, ...(args as Parameters<Ipc[T]>));
      const result: IpcResult<typeof value> = {
        success: true,
        value,
      };
      return result;
    } catch (error: any) {
      const name = error.name || 'Error';
      log.error(`[IPC] channel=${channel} name=${name} error=${error.message}`);

      const extra: Record<string, string> = { channel };
      if (error instanceof StreamError) {
        extra.stderr = error.stderr.toString('utf8');
      }

      Sentry.captureException(error, {
        tags: { source: 'ipc-handle' },
        extra,
      });
      const result: IpcError = {
        success: false,
        error: {
          message: error.message,
          name,
        },
      };
      return result;
    }
  });
}

export function handleSync<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      log.info(
        `[IPC-SYNC] channel=${channel} ${args.map((arg, idx) => `args[${idx}]=${JSON.stringify(arg)}`).join(' ')}`.trim(),
      );
      const result = handler(event, ...(args as Parameters<Ipc[T]>));
      event.returnValue = result;
      return result;
    } catch (error: any) {
      const name = error.name || 'Error';
      log.error(`[IPC-SYNC] channel=${channel} name=${name} error=${error.message}`);

      Sentry.captureException(error, {
        tags: { source: 'ipc-handleSync' },
        extra: { channel },
      });
      event.returnValue = null;
      return null;
    }
  });
}
