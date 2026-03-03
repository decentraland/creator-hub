import type { Outdated } from '/shared/types/npm';
import { PACKAGES } from '/shared/types/pkg';

import { invoke } from './ipc';
import { getPackageVersion } from './pkg';

/**
 * Installs the dependencies for a project located at the specified path.
 *
 * @param {string} path - The file system path of the project where dependencies should be installed.
 * @returns {Promise<void>} - A promise that resolves when the installation is complete.
 */
export async function install(path: string, packages: string[] = []): Promise<void> {
  await invoke('npm.install', path, packages);
}

export async function getOutdatedDeps(path: string, packages: string[] = []): Promise<Outdated> {
  return invoke('npm.getOutdatedDeps', path, packages);
}

export async function getContextFiles(path: string): Promise<void> {
  await invoke('npm.getContextFiles', path);
}

export async function getSdkCommandsVersion(path: string): Promise<string | null> {
  return (await getPackageVersion(path, PACKAGES.SDK_PACKAGE)) ?? null;
}
