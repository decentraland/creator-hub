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
