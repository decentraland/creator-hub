import fs from 'node:fs/promises';
import path from 'path';

import type { Config } from '/shared/types/config';

import { getAppHome } from './electron';

const CONFIG_FILE_NAME = 'config.json';

let config: Config | undefined;

function getDefaultConfig(): Config {
  return {
    version: 1,
    workspace: {
      paths: [],
    },
  };
}

/**
 * Returns the path to the configuration file.
 *
 * @returns {string} The configuration file path.
 */
export function getConfigPath(): string {
  return path.join(getAppHome(), CONFIG_FILE_NAME);
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
      config = JSON.parse(await fs.readFile(getConfigPath(), 'utf-8')) as Config;
    } catch (_) {
      try {
        await writeConfig(getDefaultConfig());
      } catch (e) {
        console.error('Failed initializing config file', e);
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
    const data = JSON.stringify(_config, null, 2);
    await fs.writeFile(getConfigPath(), data, 'utf-8');
    // Update the in-memory config variable with the new configuration
    config = _config;
  } catch (e) {
    console.error('Failed writing to config file', e);
    throw e;
  }
}
