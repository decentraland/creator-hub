import path from 'node:path';

export const SCENES_DIRECTORY = 'Scenes';
export const SETTINGS_DIRECTORY = 'Settings';
export const CUSTOM_ASSETS_DIRECTORY = 'Custom Items';
export const CONFIG_FILE_NAME = 'config.json';
export const INSTALLED_VERSION_FILE_NAME = 'installed-version.json';

export function getFullScenesPath(userDataPath: string): string {
  return path.join(userDataPath, SCENES_DIRECTORY);
}

/**
 * Whether `target` is `base` itself or sits beneath it.
 *
 * Uses `path.relative` rather than a string prefix, because `startsWith` reports
 * `/project-other` as being inside `/project`. Both arguments are resolved first, so `..`
 * segments are collapsed before the comparison and a relative `target` is taken against the
 * process cwd.
 */
export function isInside(base: string, target: string): boolean {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}
