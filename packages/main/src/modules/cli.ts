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

export let previewServer: Child | null = null;
export async function start(path: string) {
  if (previewServer) {
    await previewServer.kill();
  }
  const installCommand = run('npm', 'npm', { args: ['install', '--loglevel', 'error'], cwd: path });
  await installCommand.wait();
  const port = await getAvailablePort();
  previewServer = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['start', '--port', port.toString(), '--no-browser'],
    cwd: path,
  });
  const message = await previewServer.waitFor(/available/i);
  const match = message.match(/http:\/\/(\d|\.)+:\d+\?(.*)\n/); // match url printed by success message
  if (match) {
    return match[0].slice(0, -1); // remove last char because it's a new line '\n'
  } else {
    return `http://localhost:${port}`; // if match fails fallback to localhost and port, it should never happen unless the message from the CLI is changed, and the regex is not updated
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
