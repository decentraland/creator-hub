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
    const screenshot = await takeScreenshotRPC(iframe, sceneRPC);
    if (screenshot) {
      const thumbnail = (await resizeImage(screenshot, 1024, 768)) ?? undefined;
      return thumbnail;
    }
  }, []);

  return {
    generateThumbnail,
  };
}
