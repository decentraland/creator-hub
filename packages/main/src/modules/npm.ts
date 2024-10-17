import type { Outdated } from '/shared/types/npm';

import { run, StreamError } from './bin';

export async function install(path: string, packages: string[] = []) {
  const installCommand = run('npm', 'npm', {
    args: ['install', '--loglevel', 'error', ...packages.flatMap(dep => ['--save', dep])],
    cwd: path,
  });
  await installCommand.wait();
}

export async function getOutdatedDeps(_path: string, packages: string[] = []): Promise<Outdated> {
  try {
    const npmOutdated = run('npm', 'npm', {
      args: ['outdated', '--depth=0', '--json', ...packages],
      cwd: _path,
    });

    await npmOutdated.wait();
    return {};
  } catch (e) {
    if (e instanceof StreamError) {
      const data = e.stdout;
      const outdated: Outdated = JSON.parse(data.toString('utf8'));
      return outdated;
    }
    return {};
  }
}
