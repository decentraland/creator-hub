import path from 'node:path';
import { FileSystemStorage, type IFileSystemStorage } from '/shared/types/storage';
import { SETTINGS_DIRECTORY, CONFIG_FILE_NAME, getFullScenesPath } from '/shared/paths';
import { DEFAULT_CONFIG, mergeConfig, type Config } from '/shared/types/config';
import { getUserDataPath } from './electron';
import { waitForMigrations } from './migrations';
import log from 'electron-log/main';

export const CONFIG_PATH = path.join(getUserDataPath(), SETTINGS_DIRECTORY, CONFIG_FILE_NAME);

let configStorage: IFileSystemStorage | undefined;

export async function getConfig(): Promise<IFileSystemStorage> {
  await waitForMigrations();

  if (!configStorage) {
    configStorage = await FileSystemStorage.getOrCreate(CONFIG_PATH);

    // Initialize with default values if empty or merge with defaults if partial
    const defaultConfig = { ...DEFAULT_CONFIG };
    defaultConfig.settings.scenesPath = getFullScenesPath(getUserDataPath());

    const existingConfig = await configStorage.getAll<Partial<Config>>();

    // Deep merge with defaults if config exists but might be missing properties
    const mergedConfig = mergeConfig(existingConfig, defaultConfig);
    if (JSON.stringify(existingConfig) !== JSON.stringify(mergedConfig)) {
      log.info('[Config] Writing merged config to storage');
      await configStorage.setAll(mergedConfig);
    } else {
      log.info('[Config] Config already exists and is up to date');
    }
  }

  return configStorage;
}
