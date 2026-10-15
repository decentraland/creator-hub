import { getSceneClient } from '../rpc/scene';
import { copyToClipboard } from '../utils/clipboard';

export async function copyBuiltInEmoteName(name: string): Promise<void> {
  try {
    await copyToClipboard(name);
    await getSceneClient()?.pushNotification({ severity: 'success', message: `Copied "${name}"` });
  } catch (error) {
    console.error('Failed to copy the emote name:', error);
  }
}

// A built-in animation has no file to drop, so a drag attempt would otherwise just do nothing.
export function notifyBuiltInEmoteNotDraggable(name: string): void {
  void getSceneClient()
    ?.pushNotification({
      severity: 'info',
      message: `"${name}" is already available in every scene`,
      description: 'Right-click it to copy the name and play it from scene code with triggerEmote.',
    })
    .catch(error => console.error('Failed to show the built-in animation notice:', error));
}
