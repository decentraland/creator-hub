import { useCallback } from 'react';

import { takeScreenshot as takeScreenshotRPC } from '/@/modules/rpc';
import { resizeImage } from '/@/modules/image';
import { type SceneRPC } from '../modules/rpc/scene';

type Screenshot = {
  iframe: HTMLIFrameElement;
  sceneRPC?: SceneRPC;
};

export function useInspector() {
  const generateThumbnail = useCallback(async ({ iframe, sceneRPC }: Screenshot) => {
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
