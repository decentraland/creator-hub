import path from 'node:path';
import { existsSync } from 'node:fs';
import { run } from './bin';

export async function install(path: string, packageName?: string) {
  const installCommand = run('npm', 'npm', {
    args: ['install', '--loglevel', 'error', ...(packageName ? ['--save', packageName] : [])],
    cwd: path,
  });
  await installCommand.wait();
}

export async function packageOutdated(_path: string, packageName: string) {
  const normalizedPath = path.normalize(_path);
  const nodeModulesPath = path.join(normalizedPath, 'node_modules');

  if (!existsSync(nodeModulesPath)) {
    // For projects without node_modules, install dependencies before checking for outdated packages
    await install(_path);
  }

  try {
    const npmOutdated = run('npm', 'npm', {
      args: ['outdated', packageName, '--depth=0', '--json'],
      cwd: _path,
    });
    // If the npm outdated commands returns "{}", the package is updated otherwise, it returns a JSON object with outdated package versions
    await npmOutdated.waitFor(new RegExp(packageName), /\{\}/);
    return true;
  } catch (_) {
    return false;
  }
}
