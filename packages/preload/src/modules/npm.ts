import { invoke } from './invoke';

/**
 * Installs the dependencies for a project located at the specified path.
 *
 * @param {string} path - The file system path of the project where dependencies should be installed.
 * @returns {Promise<void>} - A promise that resolves when the installation is complete.
 */
export async function install(path: string): Promise<void> {
  await invoke('npm.install', path);
}
