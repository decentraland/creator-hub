import { ipcRenderer } from 'electron';
import { isUrl } from '/shared/utils';

import { invoke } from '../services/ipc';

export async function openExternal(url: string) {
  if (!isUrl(url)) throw new Error('Invalid URL provided');
  await invoke('electron.openExternal', url);
}

export async function copyToClipboard(text: string) {
  await invoke('electron.copyToClipboard', text);
}

/**
 * Gets the current environment setting synchronously.
 * Checks for CLI argument override (--env=dev or --env=prod),
 * otherwise falls back to build-time environment.
 * @returns 'dev' or 'prod'
 */
export function getEnv(): 'dev' | 'prod' {
  try {
    const result = ipcRenderer.sendSync('electron.getEnvOverride') as {
      success: boolean;
      value?: 'dev' | 'prod' | null;
    };
    if (result.success && result.value) {
      return result.value;
    }
  } catch (err) {
    console.warn('[misc] Failed to get env override, using build-time default:', err);
  }

  // Fallback to build-time environment
  return import.meta.env.DEV ? 'dev' : 'prod';
}
