import type { SaveDialogOptions } from 'electron';

import { isUrl } from '/shared/utils';

import { invoke } from '../services/ipc';

export async function openExternal(url: string) {
  if (!isUrl(url)) throw new Error('Invalid URL provided');
  await invoke('electron.openExternal', url);
}

export async function showSaveDialog(opts: Partial<SaveDialogOptions>) {
  return invoke('electron.showSaveDialog', opts);
}

export async function copyToClipboard(text: string) {
  await invoke('electron.copyToClipboard', text);
}
