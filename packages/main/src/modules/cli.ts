import log from 'electron-log/main';

import type { DeployOptions } from '/shared/types/ipc';
import type { PreviewOptions } from '/shared/types/settings';
import { CLIENT_NOT_INSTALLED_ERROR } from '/shared/utils';

import { dclDeepLink, run, type Child } from './bin';
import { getAvailablePort } from './port';
import { getProjectId } from './analytics';
import { install } from './npm';
import { APP_UNPACKED_PATH } from './path';

export type Preview = { child: Child; url: string; opts: PreviewOptions };

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
  const initCommand = await run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['init', '--yes', '--skip-install', ...(repo ? ['--github-repo', repo] : [])],
    cwd: path,
    env: await getEnv(path),
    workspace: APP_UNPACKED_PATH + '/internal',
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

type PreviewArguments = Omit<PreviewOptions, 'debugger'>;

const PREVIEW_OPTIONS_MAP: Record<keyof PreviewArguments, string> = {
  skipAuthScreen: '--skip-auth-screen',
  enableLandscapeTerrains: '--landscape-terrain-enabled',
};

function generatePreviewArguments(opts: PreviewOptions) {
  const args = [];
  for (const [opt, value] of Object.entries(PREVIEW_OPTIONS_MAP)) {
    const key = opt as keyof PreviewArguments;
    if (opts[key]) args.push(value);
  }
  return args;
}

function isPreviewRunning(opts: PreviewOptions, preview?: Preview): preview is Preview {
  return !!(
    preview?.child.alive() &&
    preview.url &&
    Object.entries(PREVIEW_OPTIONS_MAP).every(([opt]) => {
      const key = opt as keyof PreviewArguments;
      return opts[key] === preview.opts[key];
    })
  );
}

export async function start(
  path: string,
  opts: PreviewOptions & { retry?: boolean },
): Promise<string> {
  const { retry = true } = opts;
  const preview = previewCache.get(path);
  // If we have a preview running for this path with the same options, open it
  if (isPreviewRunning(opts, preview)) {
    await dclDeepLink(preview.url);
    return path;
  }

  killPreview(path);

  try {
    const process = await run('@dcl/sdk-commands', 'sdk-commands', {
      args: ['start', '--explorer-alpha', '--hub', ...generatePreviewArguments(opts)],
      cwd: path,
      workspace: path,
      env: await getEnv(path),
    });

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const resultLogs = await process.waitFor(dclLauncherURL, /CliError/i);

    // Check if the error indicates that Decentraland Desktop Client is not installed
    if (resultLogs.includes(CLIENT_NOT_INSTALLED_ERROR)) {
      throw new Error(CLIENT_NOT_INSTALLED_ERROR);
    }

    const url = resultLogs.match(dclLauncherURL)?.[1] ?? '';

    const preview = { child: process, url, opts };
    previewCache.set(path, preview);
    return path;
  } catch (error) {
    killPreview(path);
    if (retry) {
      log.info('[CLI] Something went wrong trying to start preview:', (error as Error).message);
      await install(path);
      return await start(path, { ...opts, retry: false });
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
  deployServer = await run('@dcl/sdk-commands', 'sdk-commands', {
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
