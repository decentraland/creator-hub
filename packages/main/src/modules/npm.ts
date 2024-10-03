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
      args: ['outdated', packageName, '--depth=0'],
      cwd: _path,
    });

    // If the exit code is 0, the package is up to date, otherwise it's outdated
    await npmOutdated.wait();
    return false;
  } catch (_) {
    return true;
  }
}
