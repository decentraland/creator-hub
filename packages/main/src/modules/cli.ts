import type { DeployOptions } from '/shared/types/ipc';
import { run, type Child } from './bin';
import { getAvailablePort } from './port';

export async function init(path: string, repo?: string) {
  const initCommand = run(
    '@dcl/sdk-commands',
    'sdk-commands',
    'init',
    ['--yes', '--skip-install', ...(repo ? ['--github-repo', repo] : [])],
    path,
  );
  await initCommand.wait();
  const installCommand = run('npm', 'npm', 'install', [], path);
  await installCommand.wait();
}

export let previewServer: Child | null = null;
export async function start(path: string) {
  if (previewServer) {
    await previewServer.kill();
  }
  const port = await getAvailablePort();
  previewServer = run(
    '@dcl/sdk-commands',
    'sdk-commands',
    'start',
    ['--port', port.toString(), '--no-browser', '--data-layer'],
    path,
    {
      basePath: path,
    },
  );
  await previewServer.waitFor(/available/i);
  return port;
}

export let deployServer: Child | null = null;
export async function deploy({ path, target, targetContent }: DeployOptions) {
  if (deployServer) {
    await deployServer.kill();
  }
  const port = await getAvailablePort();
  deployServer = run(
    '@dcl/sdk-commands',
    'sdk-commands',
    'deploy',
    [
      '--port',
      port.toString(),
      ...(target ? ['--target', target] : []),
      ...(targetContent ? ['--target-content', targetContent] : []),
    ],
    path,
  );
  return port;
}
