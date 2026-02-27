import * as Sentry from '@sentry/electron/main';

type Source = 'ipc-handle' | 'ipc-handleSync' | 'auto-updater' | 'migrations' | 'before-quit';

export function capture(
  error: unknown,
  source: Source,
  step?: string,
  extra?: Record<string, unknown>,
) {
  Sentry.captureException(error, {
    tags: {
      source,
      ...(step ? { step } : {}),
    },
    ...(extra ? { extra } : {}),
  });
}
