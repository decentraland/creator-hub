import { isUrl } from '/shared/utils';

import { invoke } from './invoke';

export async function openExternal(url: string) {
  if (!isUrl(url)) throw new Error('Invalid URL provided');
  await invoke('electron.openExternal', url);
}
