import { EXTENSIONS, getParentPath } from '../data-layer/host/fs-utils';
import { joinPath, normalizePath } from './path-utils';

/**
 * The file a Script's string parameter names, relative to the script's folder.
 *
 * @returns undefined when `value` is empty, has a `:` (a url) or isn't a clean path.
 */
export function resolveScriptFile(scriptPath: string, value: string): string | undefined {
  if (!value || value.includes(':') || normalizePath(value) !== value) return undefined;
  return normalizePath(joinPath(getParentPath(scriptPath), value));
}

/**
 * Whether a Script's string parameter names an asset file that isn't in the scene.
 *
 * @param files - the scene's file paths, lowercased.
 */
export function isMissingScriptFile(
  scriptPath: string,
  value: string,
  files: ReadonlySet<string>,
): boolean {
  const file = resolveScriptFile(scriptPath, value);
  if (!file) return false;
  const lower = file.toLowerCase();
  return EXTENSIONS.some(extension => lower.endsWith(extension)) && !files.has(lower);
}
