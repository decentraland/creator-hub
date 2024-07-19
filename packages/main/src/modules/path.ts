import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { type PackageJson } from '/shared/types/pkg';

export function getBinPath(pkg: string, bin: string, basePath: string = app.getAppPath()) {
  const pkgPath = path.join(basePath, './node_modules', pkg);
  let pkgJson: PackageJson;
  try {
    pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
  } catch (error) {
    throw new Error(`Could not find package.json for module "${pkg}" in ${pkgPath}`);
  }

  if (!pkgJson.bin || !pkgJson.bin[bin]) {
    throw new Error(`Could not find bin "${bin}" in package.json for module "${pkg}"`);
  }

  return path.join(pkgPath, pkgJson.bin[bin]);
}

/**
 * Helper to get the absolute path to the node bin given the user platform
 * @returns The path to the node bin
 */
export function getNodeCmdPath() {
  const cmd = process.platform === 'win32' ? 'node.cmd' : 'node';
  return path.join(app.getAppPath(), cmd);
}

/**
 * Combines different paths as a single env PATH using the right separator given the user's platform
 */

export function joinEnvPaths(...paths: (undefined | string)[]) {
  const separator = process.platform === 'win32' ? ';' : ':';
  return paths.filter((path): path is string => !!path).join(separator);
}
