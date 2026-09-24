import fs from 'node:fs/promises';
import path from 'node:path';
import { type PackageJson } from '/shared/types/pkg';

/**
 * Return the package json of a given module
 * @param path The path to the package json
 * @param moduleName The name of the module
 * @returns The package json object
 */
export async function getPackageJson(
  _path: string,
  moduleName?: string | null,
): Promise<PackageJson> {
  const packageJsonPath = moduleName
    ? path.join(_path, './node_modules', moduleName, 'package.json')
    : path.join(_path, 'package.json');
  try {
    const file = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(file);
  } catch (error: any) {
    throw new Error(`Could not get package.json for module "${moduleName}": ${error.message}`);
  }
}

/**
 * Returns the version of a given module if exists, otherwise returns null
 */
export async function getPackageVersion(_path: string, moduleName?: string) {
  try {
    const pkg = await getPackageJson(_path, moduleName);
    return pkg.version;
  } catch (_) {
    return null;
  }
}

/**
 * Returns whether or not there's a dependency on a module
 */
export async function hasDependency(_path: string, moduleName: string) {
  const pkg = await getPackageJson(_path, undefined);
  const isDependency = !!pkg.dependencies && moduleName in pkg.dependencies;
  const isDevDependency = !!pkg.devDependencies && moduleName in pkg.devDependencies;
  return isDependency || isDevDependency;
}

/**
 * Returns whether a module inside the project's node_modules ships a given file.
 * Used to feature-detect optional subpaths that carry no package.json marker.
 */
export async function hasModuleEntry(_path: string, moduleName: string, subpath: string) {
  try {
    await fs.access(path.join(_path, 'node_modules', moduleName, subpath));
    return true;
  } catch (_) {
    return false;
  }
}
