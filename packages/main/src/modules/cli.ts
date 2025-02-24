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
  const preview = previewCache.get(path);
  const promise = preview?.child.kill().catch(() => {});
  previewCache.delete(path);
  await promise;
}

type Preview = { child: Child; previewURL: string };
export const previewCache: Map<string, Preview> = new Map();

export async function start(path: string, retry = true) {
  const preview = previewCache.get(path);
  // If we have a preview running for this path, open it
  if (preview?.child.alive() && preview.previewURL) {
    await dclDeepLink(preview.previewURL);
    return;
  }

  killPreview(path);

  try {
    // TODO: remove this once we have merged the asset-packs PR
    log.info('[CLI] Installing some dev dependencies...', { path });
    for (const pkg of [
      'https://sdk-team-cdn.decentraland.org/@dcl/js-sdk-toolchain/branch/feat/add-admin-toolkit-smart-item/dcl-sdk-7.7.6-13503617377.commit-9cf29f7.tgz',
      'https://sdk-team-cdn.decentraland.org/@dcl/asset-packs/branch/feat/add-admin-toolkit-smart-item/dcl-asset-packs-2.1.3-13503515636.commit-ce30ee1.tgz',
    ]) {
      const npmInstall = run('npm', 'npm', {
        args: ['install', '--save-dev', pkg, '--loglevel', 'error'],
        cwd: path,
      });
      await npmInstall.wait();
    }

    const process = run('@dcl/sdk-commands', 'sdk-commands', {
      args: ['start', '--explorer-alpha', '--hub'],
      cwd: path,
      workspace: path,
      env: await getEnv(path),
    });

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const resultLogs = await process.waitFor(dclLauncherURL, /CliError/i);
    const previewURL = resultLogs.match(dclLauncherURL)?.[1] ?? '';

    previewCache.set(path, { child: process, previewURL });
  } catch (error) {
    killPreview(path);
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
