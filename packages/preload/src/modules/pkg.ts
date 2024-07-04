import fs from 'node:fs';
import path from 'node:path';

type PackageJson = {
  version: string;
  engines: {
    node: string;
  };
  bin?: {[command: string]: string};
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * Return the package json of a given module
 * @param path The path to the package json
 * @param moduleName The name of the module
 * @returns The package json object
 */
export function getPackageJson(_path: string, moduleName?: string | null): PackageJson {
  const packageJsonPath = moduleName
    ? path.join(_path, './node_modules', moduleName, 'package.json')
    : path.join(_path, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error: any) {
    throw new Error(`Could not get package.json for module "${moduleName}": ${error.message}`);
  }
}

/**
 * Returns the version of a given module if exists, otherwise returns null
 */
export function getPackageVersion(_path: string, moduleName?: string) {
  try {
    const pkg = getPackageJson(_path, moduleName);
    return pkg.version;
  } catch (_) {
    return null;
  }
}

/**
 * Returns whether or not there's a dependency on a module
 */
export function hasDependency(_path: string, moduleName: string) {
  const pkg = getPackageJson(_path, undefined);
  const isDependency = !!pkg.dependencies && moduleName in pkg.dependencies;
  const isDevDependency = !!pkg.devDependencies && moduleName in pkg.devDependencies;
  return isDependency || isDevDependency;
}
