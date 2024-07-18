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
