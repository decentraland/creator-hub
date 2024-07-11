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

let currentStart: Command | null = null;
export async function start(path: string) {
  if (currentStart) {
    await currentStart.kill();
  }
  currentStart = npx('@dcl/sdk-commands', ['start'], path);
}

let currentDeploy: Command | null = null;
export async function deploy(path: string) {
  if (currentDeploy) {
    await currentDeploy.kill();
  }
  currentDeploy = npx('@dcl/sdk-commands', ['deploy'], path);
}

export async function killAll() {
  const promises = [];
  if (currentStart) {
    promises.push(currentStart.kill());
  }
  if (currentDeploy) {
    promises.push(currentDeploy.kill());
  }
  await Promise.all(promises);
}
