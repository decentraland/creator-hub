import path from 'node:path';
import { FileSystemStorage } from '/shared/types/storage';
import { SETTINGS_DIRECTORY, CONFIG_FILE_NAME, getFullScenesPath } from '/shared/paths';
import { DEFAULT_CONFIG, mergeConfig } from '/shared/types/config';
import { getUserDataPath } from './electron';

export const CONFIG_PATH = path.join(getUserDataPath(), SETTINGS_DIRECTORY, CONFIG_FILE_NAME);
const storage = await FileSystemStorage.getOrCreate(CONFIG_PATH);

// Initialize with default values if empty
const existingConfig = await storage.get<Record<string, any>>('');
const defaultConfig = { ...DEFAULT_CONFIG };
defaultConfig.settings.scenesPath = getFullScenesPath(getUserDataPath());

if (!existingConfig || Object.keys(existingConfig).length === 0) {
  // Write the default config
  for (const [key, value] of Object.entries(defaultConfig)) {
    await storage.set(key, value);
  }
} else {
  // Deep merge with defaults if config exists but might be missing properties
  const mergedConfig = mergeConfig(existingConfig, defaultConfig);
  if (JSON.stringify(existingConfig) !== JSON.stringify(mergedConfig)) {
    for (const [key, value] of Object.entries(mergedConfig)) {
      await storage.set(key, value);
    }
  }
}

export const config = storage;
