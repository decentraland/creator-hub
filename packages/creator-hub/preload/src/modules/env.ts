import { ipcRenderer } from 'electron';
import { Env } from '/shared/types/env';

/**
 * Gets the environment setting synchronously.
 * Checks main process for CLI argument override (--env=dev or --env=prod),
 * otherwise falls back to build-time environment.
 * @returns 'dev' or 'prod'
 */
export function getEnv(): Env {
  try {
    const envOverride = ipcRenderer.sendSync('electron.getEnvOverride') as Env | null;
    if (envOverride) {
      return envOverride;
    }
  } catch (err) {
    console.warn('[env] Failed to get CLI override from main process:', err);
  }

  return import.meta.env.DEV ? Env.DEV : Env.PROD;
}
