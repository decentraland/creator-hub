import { produce, type WritableDraft } from 'immer';

import type { Config } from '/shared/types/config';

import { invoke } from './invoke';

export async function setConfig(drafter: (c: WritableDraft<Config>) => void): Promise<void> {
  const config = await invoke('config.get');
  // Immer doesn't allow updating + returning a value, so if we want to allow this syntax when
  // calling setConfig: setConfig((config) => config.paths.push(somePath));
  // then we have to do this 👇...
  const update = produce(config, draft => {
    drafter(draft);
  });
  await invoke('config.write', update);
}
