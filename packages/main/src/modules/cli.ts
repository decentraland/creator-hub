import type { DeployOptions } from '/shared/types/ipc';
import { run, type Child } from './bin';
import { getAvailablePort } from './port';

export async function init(path: string, repo?: string) {
  const initCommand = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['init', '--yes', '--skip-install', ...(repo ? ['--github-repo', repo] : [])],
    cwd: path,
  });
  await initCommand.wait();
}

export async function install(path: string) {
  const installCommand = run('npm', 'npm', { args: ['install', '--loglevel', 'error'], cwd: path });
  await installCommand.wait();
}

export let previewServer: Child | null = null;
export async function start(path: string) {
  if (previewServer) {
    await previewServer.kill();
  }
  await install(path);
  previewServer = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['start', '--explorer-alpha'],
    cwd: path,
  });
  await previewServer.waitFor(/decentraland:\/\//i);
}

export let deployServer: Child | null = null;
export async function deploy({ path, target, targetContent }: DeployOptions) {
  if (deployServer) {
    await deployServer.kill();
  }
  const port = await getAvailablePort();
  deployServer = run('@dcl/sdk-commands', 'sdk-commands', {
    args: [
      'deploy',
      '--port',
      port.toString(),
      ...(target ? ['--target', target] : []),
      ...(targetContent ? ['--target-content', targetContent] : []),
    ],
    cwd: path,
  });

  // App ready at
  await deployServer.waitFor(/app ready at/i);

  return port;
}
