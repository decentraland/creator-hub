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

let currentPreview: Command | null = null;
export async function preview(path: string) {
  if (currentPreview) {
    await currentPreview.kill();
  }
  currentPreview = npx('@dcl/sdk-commands', ['start'], path);
}

let currentPublish: Command | null = null;
export async function publish(path: string) {
  if (currentPublish) {
    await currentPublish.kill();
  }
  currentPublish = npx('@dcl/sdk-commands', ['publish'], path);
}

export async function killAll() {
  const promises = [];
  if (currentPreview) {
    promises.push(currentPreview.kill());
  }
  if (currentPublish) {
    promises.push(currentPublish.kill());
  }
  await Promise.all(promises);
}
