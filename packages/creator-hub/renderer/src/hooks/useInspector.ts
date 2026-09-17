import { useCallback } from 'react';

import { takeScreenshot as takeScreenshotRPC } from '/@/modules/rpc';
import { resizeImage } from '/@/modules/image';
import { type SceneRpcClient } from '../modules/rpc/scene/client';

type Screenshot = {
  iframe: HTMLIFrameElement;
  scene?: SceneRpcClient;
};

export function useInspector() {
  const generateThumbnail = useCallback(async ({ iframe, scene: sceneRPC }: Screenshot) => {
    // takeScreenshot rejects (rather than hanging) when no renderer answers the
    // scene RPC — e.g. under the Bevy renderer, which has no screenshot server.
    // Treat that as "no thumbnail" so callers (some fire-and-forget) don't see an
    // unhandled rejection; a real failure is likewise non-fatal here.
    const screenshot = await takeScreenshotRPC(iframe, sceneRPC).catch(() => undefined);
    if (screenshot) {
      const thumbnail = (await resizeImage(screenshot, 1024, 768)) ?? undefined;
      return thumbnail;
    }
  }, []);

  return {
    generateThumbnail,
  };
}
