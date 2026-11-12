import { ipcMain } from 'electron';
import log from 'electron-log';

import type { Ipc, IpcError, IpcResult } from '/shared/types/ipc';
import { captureException } from '@sentry/electron/main';
import { StreamError } from './bin';

const SENSITIVE_KEY =
  /^x-identity-|auth-?chain|auth_chain|authorization|password|token|secret|email|contact/i;

const CONTENT_CHANNELS = new Set<keyof Ipc>([
  'ai.submitSignInCode',
  'ai.send',
  'ai.screenshotResult',
  'ai.askResult',
  'ai.mirrorPush',
  'ai.remoteCommand',
]);

function shortenDataUrl(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return value;
  return `[data:${value.slice(5, value.search(/[;,]|$/))}, ${value.length} bytes]`;
}

/**
 * Renders IPC arguments for the log. Credential-shaped values and contact details are
 * masked and data URLs shortened, because these lines land in the electron log on disk,
 * which issue reports attach.
 */
export function formatArgs(args: unknown[]): string {
  return args
    .map(
      (arg, idx) =>
        `args[${idx}]=${JSON.stringify(arg, (key, value) =>
          SENSITIVE_KEY.test(key) ? '[redacted]' : shortenDataUrl(value),
        )}`,
    )
    .join(' ');
}

function logArgs(channel: keyof Ipc, args: unknown[]) {
  return CONTENT_CHANNELS.has(channel) ? '[redacted]' : formatArgs(args);
}

export async function handle<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      log.info(`[IPC] channel=${channel} ${logArgs(channel, args)}`.trim());
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

      if (name !== 'AbortError' && channel !== 'feedback.send') {
        captureException(error, { tags: { source: 'ipc-handle' }, extra });
      }
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
      log.info(`[IPC-SYNC] channel=${channel} ${logArgs(channel, args)}`.trim());
      const result = handler(event, ...(args as Parameters<Ipc[T]>));
      event.returnValue = result;
      return result;
    } catch (error: any) {
      const name = error.name || 'Error';
      log.error(`[IPC-SYNC] channel=${channel} name=${name} error=${error.message}`);

      captureException(error, { tags: { source: 'ipc-handleSync' }, extra: { channel } });
      event.returnValue = null;
      return null;
    }
  });
}
