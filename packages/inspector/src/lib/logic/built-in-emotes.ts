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
