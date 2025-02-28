import log from 'electron-log/main';
import type { DeployOptions } from '/shared/types/ipc';
import { dclDeepLink, run, type Child } from './bin';
import { getAvailablePort } from './port';
import { getProjectId } from './analytics';
import { install } from './npm';

export type Preview = { child: Child; previewURL: string };

const previewCache: Map<string, Preview> = new Map();
export let deployServer: Child | null = null;

export function getPreview(path: string) {
  return previewCache.get(path);
}

async function getEnv(path: string) {
  const projectId = await getProjectId(path);
  return {
    ANALYTICS_PROJECT_ID: projectId,
    ANALYTICS_APP_ID: 'creator-hub',
  };
}

export async function init(path: string, repo?: string): Promise<void> {
  const initCommand = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['init', '--yes', '--skip-install', ...(repo ? ['--github-repo', repo] : [])],
    cwd: path,
    env: await getEnv(path),
  });
  await initCommand.wait();
}

export async function killPreview(path: string) {
  const preview = previewCache.get(path);
  const promise = preview?.child.kill().catch(() => {});
  previewCache.delete(path);
  await promise;
}

export async function killAllPreviews() {
  for (const path of previewCache.keys()) {
    await killPreview(path);
  }
  previewCache.clear(); // just to be sure...
}

export async function start(path: string, retry = true): Promise<string> {
  const preview = previewCache.get(path);
  // If we have a preview running for this path, open it
  if (preview?.child.alive() && preview.previewURL) {
    await dclDeepLink(preview.previewURL);
    return path;
  }

  killPreview(path);

  try {
    const process = run('@dcl/sdk-commands', 'sdk-commands', {
      args: ['start', '--explorer-alpha', '--hub'],
      cwd: path,
      workspace: path,
      env: await getEnv(path),
    });

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const resultLogs = await process.waitFor(dclLauncherURL, /CliError/i);
    const previewURL = resultLogs.match(dclLauncherURL)?.[1] ?? '';

    const preview = { child: process, previewURL };
    previewCache.set(path, preview);
    return path;
  } catch (error) {
    killPreview(path);
    if (retry) {
      log.info('[CLI] Something went wrong trying to start preview:', (error as Error).message);
      await install(path);
      return await start(path, false);
    } else {
      throw error;
    }
  }
}

export async function deploy({ path, target, targetContent }: DeployOptions): Promise<number> {
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
