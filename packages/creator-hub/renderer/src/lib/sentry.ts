import { captureException } from '@sentry/electron/renderer';

type Source = 'deployment' | 'editor-page' | 'workspace' | 'land' | 'ens' | 'auth';

const scheduleIdle =
  typeof requestIdleCallback === 'function'
    ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5_000 })
    : (cb: () => void) => setTimeout(cb, 0);

export function capture(
  error: unknown,
  source: Source,
  step?: string,
  extra?: Record<string, unknown>,
) {
  scheduleIdle(() => {
    captureException(error, {
      tags: {
        source,
        ...(step ? { step } : {}),
      },
      ...(extra ? { extra } : {}),
    });
  });
}
