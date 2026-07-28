import path from 'node:path';
import { existsSync } from 'node:fs';
import log from 'electron-log/main';

import { FileSystemStorage, type IFileSystemStorage } from '/shared/types/storage';
import deepmerge from 'deepmerge';
import { SETTINGS_DIRECTORY, CONFIG_FILE_NAME, getFullScenesPath } from '/shared/paths';
import { DEFAULT_CONFIG, mergeConfig, type Config } from '/shared/types/config';

import { getUserDataPath } from './electron';
import { waitForMigrations } from './migrations';

export const CONFIG_PATH = path.join(getUserDataPath(), SETTINGS_DIRECTORY, CONFIG_FILE_NAME);

let configStorage: IFileSystemStorage<Config> | undefined;

export function getDefaultConfig(): Config {
  const defaultConfig = deepmerge({}, DEFAULT_CONFIG);
  defaultConfig.settings.scenesPath = getFullScenesPath(getUserDataPath());
  return defaultConfig;
}

export async function getConfigStorage(): Promise<IFileSystemStorage<Config>> {
  await waitForMigrations();

  if (!configStorage) {
    configStorage = await FileSystemStorage.getOrCreate(CONFIG_PATH);

    // Initialize with default values if empty or merge with defaults if partial
    const defaultConfig = getDefaultConfig();
    const existingConfig = await configStorage.getAll();

    // Deep merge with defaults if config exists but might be missing properties
    const mergedConfig = mergeConfig(existingConfig, defaultConfig);

    // `previewOptions.optimizedAssets` is the ephemeral value for the open project; the persisted
    // per-project preference lives in `settings.optimizedAssetsByPath` and is hydrated on project
    // open (inert — no conversion until Preview). Start the live flag off so no stale global value
    // leaks in before a project hydrates it.
    if (mergedConfig.settings?.previewOptions) {
      mergedConfig.settings.previewOptions.optimizedAssets = false;
    }

    // Prune per-project Optimize Assets preferences whose project no longer exists on disk, so
    // the map doesn't grow unbounded (entries for unlisted projects are dropped on unlist).
    const optimizedAssetsByPath = mergedConfig.settings?.optimizedAssetsByPath;
    if (optimizedAssetsByPath) {
      for (const projectPath of Object.keys(optimizedAssetsByPath)) {
        if (!existsSync(projectPath)) {
          delete optimizedAssetsByPath[projectPath];
        }
      }
    }
    //Todo improve comparison
    if (JSON.stringify(existingConfig) !== JSON.stringify(mergedConfig)) {
      log.info('[Config] Writing merged config to storage');
      await configStorage.setAll(mergedConfig);
    } else {
      log.info('[Config] Config already exists and is up to date');
    }
  }

  return configStorage;
}

export async function getConfig(): Promise<Config> {
  return (await getConfigStorage()).getAll();
}

/**
 * Writes the provided configuration object to the configuration file.
 *
 * @param {Config} _config - The configuration object to write to the file.
 * @returns {Promise<void>} A promise that resolves when the write operation is complete.
 */
export async function writeConfig(_config: Config): Promise<void> {
  try {
    const config = await getConfigStorage();
    config.setAll(_config);
  } catch (e) {
    console.error('[Preload] Failed writing to config file', e);
    throw e;
  }
}
