import { getSceneClient } from '../rpc/scene';

// Electron denies navigator.clipboard to the inspector iframe, so inside Creator Hub the host
// copies; the standalone inspector is a normal browser tab and uses the browser API.
export async function copyToClipboard(text: string): Promise<void> {
  const sceneClient = getSceneClient();
  if (sceneClient) {
    await sceneClient.copyToClipboard(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}
