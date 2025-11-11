import { type Config } from '/shared/types/config';

import { invoke } from './ipc';
import { produce, type WritableDraft } from 'immer';

export async function getConfig(): Promise<Config> {
  return invoke('config.getConfig');
}

export async function setConfig(drafter: (c: WritableDraft<Config>) => void): Promise<void> {
  const config = await getConfig();
  const update = produce(config, draft => {
    drafter(draft);
  });
  await invoke('config.writeConfig', update);
}

/**
 * Retrieves the configuration path for a given workspace path.
 *
 * @param {string} path - The path to the workspace.
 * @returns {Promise<string>} A promise that resolves to the configuration path.
 */
export async function getWorkspaceConfigPath(path: string) {
  return invoke('electron.getWorkspaceConfigPath', path);
}
