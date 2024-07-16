import type { Command } from './npx';
import { npx } from './npx';
import { getAvailablePort } from './port';

export async function init(path: string, repo?: string) {
  const command = npx(
    '@dcl/sdk-commands',
    ['init', '--yes', ...(repo ? ['--github-repo', repo] : [])],
    path,
  );
  return command.wait();
}

export let previewServer: Command | null = null;
export async function start(path: string) {
  if (previewServer) {
    await previewServer.kill();
  }
  const port = await getAvailablePort();
  previewServer = npx(
    '@dcl/sdk-commands',
    ['start', '--port', port.toString(), '--no-browser', '--data-layer'],
    path,
  );
  await previewServer.waitFor(/available/i);
  return port;
}

export let deployServer: Command | null = null;
export async function deploy(path: string) {
  if (deployServer) {
    await deployServer.kill();
  }
  const port = await getAvailablePort();
  deployServer = npx('@dcl/sdk-commands', ['deploy', '--port', port.toString()], path);
  return port;
}
