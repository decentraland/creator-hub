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

const API_URL_OVERRIDES = [
  'CREATOR_FUND_API_URL',
  'METRICS_API_URL',
  'WORLDS_CONTENT_SERVER_URL',
] as const;

/**
 * API base URLs from the environment, overriding the renderer config.
 * @returns the set ones in a dev build; `{}` in a release build.
 */
export function getApiUrlOverrides(): Partial<Record<(typeof API_URL_OVERRIDES)[number], string>> {
  if (!import.meta.env.DEV) return {};
  return Object.fromEntries(
    API_URL_OVERRIDES.filter(name => process.env[name]).map(name => [name, process.env[name]]),
  );
}
