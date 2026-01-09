import { isUrl } from '/shared/utils';
import type { OpenDialogOptions } from 'electron';

import { invoke } from '../services/ipc';

export async function openExternal(url: string) {
  if (!isUrl(url)) throw new Error('Invalid URL provided');
  await invoke('electron.openExternal', url);
}

export async function copyToClipboard(text: string) {
  await invoke('electron.copyToClipboard', text);
}

export async function showOpenDialog(options: Partial<OpenDialogOptions>): Promise<string[]> {
  return invoke('electron.showOpenDialog', options);
}
