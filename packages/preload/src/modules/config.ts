import fs from 'node:fs/promises';
import path from 'path';
import { produce, type WritableDraft } from 'immer';

import type { Config } from '/shared/types/config';
import { DEFAULT_DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';

import { invoke } from './invoke';
import { getDefaultScenesPath } from './settings';
import { SETTINGS_DIRECTORY } from '/shared/paths';

const CONFIG_FILE_NAME = 'config.json';

let config: Config | undefined;

async function getDefaultConfig(): Promise<Config> {
  return {
    version: 1,
    workspace: {
      paths: [],
    },
    settings: {
      scenesPath: await getDefaultScenesPath(),
      dependencyUpdateStrategy: DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
    },
  };
}

/**
 * Returns the path to the configuration file.
 *
 * @returns {Promise<string>} The configuration file path.
 */
export async function getConfigPath(): Promise<string> {
  const userDataPath = await invoke('electron.getUserDataPath');
  try {
    await fs.stat(userDataPath);
  } catch (_) {
    await fs.mkdir(userDataPath);
  }
  return path.join(userDataPath, SETTINGS_DIRECTORY, CONFIG_FILE_NAME);
}

/**
 * Retrieves the configuration object. If the configuration is not already loaded,
 * it attempts to read the configuration file. If the file does not exist or reading it fails,
 * it writes the default configuration to the file.
 *
 * @returns {Promise<Readonly<Config>>} A promise that resolves to the configuration object.
 */
export async function getConfig(): Promise<Readonly<Config>> {
  if (!config) {
    try {
      const configPath = await getConfigPath();
      config = JSON.parse(await fs.readFile(configPath, 'utf-8')) as Config;
    } catch (_) {
      try {
        await writeConfig(await getDefaultConfig());
      } catch (e) {
        console.error('[Preload] Failed initializing config file', e);
      }
    }
  }

  return config || getDefaultConfig();
}

/**
 * Writes the provided configuration object to the configuration file.
 *
 * @param {Config} _config - The configuration object to write to the file.
 * @returns {Promise<void>} A promise that resolves when the write operation is complete.
 */
export async function writeConfig(_config: Config): Promise<void> {
  try {
    const configPath = await getConfigPath();
    const data = JSON.stringify(_config, null, 2);
    await fs.writeFile(configPath, data, 'utf-8');
    // Update the in-memory config variable with the new configuration
    config = _config;
  } catch (e) {
    console.error('[Preload] Failed writing to config file', e);
    throw e;
  }
}

export async function setConfig(drafter: (c: WritableDraft<Config>) => void): Promise<void> {
  const config = await getConfig();
  // Immer doesn't allow updating + returning a value, so if we want to allow this syntax when
  // calling setConfig: setConfig((config) => config.paths.push(somePath));
  // then we have to do this 👇...
  const update = produce(config, draft => {
    drafter(draft);
  });
  await writeConfig(update);
}
