import type { DeployOptions } from '/shared/types/ipc';
import { run, type Child } from './bin';
import { getAvailablePort } from './port';
import { install } from './npm';
import { getProjectId } from './analytics';

async function getEnv(path: string) {
  const projectId = await getProjectId(path);
  return {
    ANALYTICS_PROJECT_ID: projectId,
    ANALYTICS_APP_ID: 'creator-hub',
  };
}

export async function init(path: string, repo?: string) {
  const initCommand = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['init', '--yes', '--skip-install', ...(repo ? ['--github-repo', repo] : [])],
    cwd: path,
    env: await getEnv(path),
  });
  await initCommand.wait();
}

export let previewServer: Child | null = null;
export async function start(path: string) {
  if (previewServer) {
    await previewServer.kill();
  }
  await install(path);
  previewServer = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['start', '--explorer-alpha', '--hub'],
    cwd: path,
    env: await getEnv(path),
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
      '--no-browser',
      '--port',
      port.toString(),
      ...(target ? ['--target', target] : []),
      ...(targetContent ? ['--target-content', targetContent] : []),
    ],
    cwd: path,
    env: await getEnv(path),
  });

  // App ready at
  await deployServer.waitFor(/listening/i, /error:/i, { reject: 'stderr' });

  deployServer.waitFor(/close the terminal/gi).then(() => deployServer?.kill());

  deployServer.wait().catch(); // handle rejection of main promise to avoid warnings in console

  return port;
}
