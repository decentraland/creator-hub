import type { Command } from './npx';
import { npx } from './npx';

export async function init(path: string, repo?: string) {
  const command = npx(
    '@dcl/sdk-commands',
    ['init', '--yes', ...(repo ? ['--github-repo', repo] : [])],
    path,
  );
  return command.wait();
}

export let startServer: Command | null = null;
export async function start(path: string) {
  if (startServer) {
    await startServer.kill();
  }
  startServer = npx('@dcl/sdk-commands', ['start'], path);
}

export let deployServer: Command | null = null;
export async function deploy(path: string) {
  if (deployServer) {
    await deployServer.kill();
  }
  deployServer = npx('@dcl/sdk-commands', ['deploy'], path);
}
