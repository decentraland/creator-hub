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
  /*
   TODO: do something about "--ignore-scripts"
   We are ignoring the scripts because there are some postinstall scripts that call "node" globally, and it's not available in the context of the Electron.UtilityProcess we use.
   Scenes seem to be working fine without the postinstalls (at the time of writing this there are two postinstalls, one from "esbuild" and another one from "protobufjs").
   In the future this might break something. We might need to find all the dependencies that have postinstall scripts, and run them manually.
   We could potentially run `npm query ":attr(scripts, [postinstall])"` to get all the packages with postinstall scripts, then run them in sequence using Electron.UtilityProcess instead of `node`, although that could open a whole new can of worms.
  */
  const installCommand = run('npm', 'npm', 'install', ['--ignore-scripts'], path);
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
    ['--port', port.toString(), '--no-browser', '--data-layer', '--skip-install'],
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
