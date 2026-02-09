import { ipcRenderer } from 'electron';

/**
 * Gets the environment setting synchronously.
 * Checks main process for CLI argument override (--env=dev or --env=prod),
 * otherwise falls back to build-time environment.
 * @returns 'dev' or 'prod'
 */
export function getEnv(): 'dev' | 'prod' {
  try {
    // Ask main process for the env override from CLI args
    const envOverride = ipcRenderer.sendSync('get-env-override') as 'dev' | 'prod' | null;
    if (envOverride) {
      return envOverride;
    }
  } catch (err) {
    console.warn('[env] Failed to get CLI override from main process:', err);
  }

  // Fallback to build-time environment
  return import.meta.env.DEV ? 'dev' : 'prod';
}
