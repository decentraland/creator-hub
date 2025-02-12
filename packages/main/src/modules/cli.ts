import log from 'electron-log/main';
import type { DeployOptions } from '/shared/types/ipc';
import { dclDeepLink, run, type Child } from './bin';
import { getAvailablePort } from './port';
import { getProjectId } from './analytics';
import { install } from './npm';

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

export async function killPreview(path: string) {
  if (previewCache[path]?.child) {
    previewCache[path]?.child?.kill().catch(() => {});
  }
  previewCache[path] = null;
}

export const previewCache: Record<string, { child: Child; previewURL: string } | null> = {};

export async function start(path: string, retry = true) {
  // If we have a preview running for this path, open it
  if (previewCache[path]?.child.alive() && previewCache[path]?.previewURL) {
    await dclDeepLink(previewCache[path]?.previewURL);
    return;
  }

  previewCache[path]?.child?.kill().catch(() => {});

  try {
    previewCache[path] = {
      child: run('@dcl/sdk-commands', 'sdk-commands', {
        args: ['start', '--explorer-alpha', '--hub'],
        cwd: path,
        workspace: path,
        env: await getEnv(path),
      }),
      previewURL: '',
    };

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const resultLogs = await previewCache[path].child.waitFor(dclLauncherURL, /CliError/i);
    const urlMatch = resultLogs.match(dclLauncherURL);
    previewCache[path].previewURL = urlMatch?.[1] ?? '';
  } catch (error) {
    previewCache[path] = null;
    if (retry) {
      log.info('[CLI] Something went wrong trying to start preview:', (error as Error).message);
      await install(path);
      await start(path, false);
    } else {
      throw error;
    }
  }
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
    workspace: path,
  });

  // App ready at
  await deployServer.waitFor(/listening/i, /error:/i, { reject: 'stderr' });

  deployServer.waitFor(/close the terminal/gi).then(() => deployServer?.kill());

  deployServer.wait().catch(); // handle rejection of main promise to avoid warnings in console

  return port;
}
