import { ipcMain } from 'electron';
import log from 'electron-log';

import type { Ipc, IpcError, IpcResult } from '/shared/types/ipc';
import { captureException } from '@sentry/electron/main';
import { StreamError } from './bin';

// `rawBody`/`body` carry request payloads; the AI sharing upload's are conversation records.
const SENSITIVE_KEY = /^x-identity-|auth-chain|authorization|password|token|secret|^(raw)?body$/i;

/**
 * `ai.*` and `aiSharing.*` channels carry what the user typed (prompts, `ask_user` answers, the
 * sign-in code), the whole conversation (`ai.mirrorPush`) and screenshots. The
 * electron log is attached to bug reports, so for these only the shape is logged.
 */
const CONTENT_CHANNEL = /^ai[.A-Z]/;

const MAX_SHAPE_DEPTH = 3;

function describeShape(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return `<${value.length} chars>`;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return `<${value.length} items>`;
  if (depth >= MAX_SHAPE_DEPTH) return '<object>';
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, describeShape(entry, depth + 1)]),
  );
}

/**
 * Renders IPC arguments for the log. Credential-shaped values are masked because
 * these lines land in the electron log on disk — `metrics.request` alone carries
 * a signed ADR-44 auth chain on every call.
 */
export function formatArgs(args: unknown[], channel?: string): string {
  const shapeOnly = channel !== undefined && CONTENT_CHANNEL.test(channel);
  return args
    .map(
      (arg, idx) =>
        `args[${idx}]=${JSON.stringify(shapeOnly ? describeShape(arg) : arg, (key, value) =>
          SENSITIVE_KEY.test(key) ? '[redacted]' : value,
        )}`,
    )
    .join(' ');
}

// wrapper for ipcMain.handle with types
export async function handle<T extends keyof Ipc>(
  channel: T,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: Parameters<Ipc[T]>) => ReturnType<Ipc[T]>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      log.info(`[IPC] channel=${channel} ${formatArgs(args, channel)}`.trim());
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

      if (name !== 'AbortError') {
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
      log.info(`[IPC-SYNC] channel=${channel} ${formatArgs(args, channel)}`.trim());
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
