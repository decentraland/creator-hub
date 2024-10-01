import { useCallback } from 'react';
import { type Scene } from '@dcl/schemas';

import { useDispatch } from '#store';

import type { Project } from '/shared/types/projects';
import { throttle } from '/shared/utils';
import { seconds } from '/shared/time';

import { actions as workspaceActions } from '/@/modules/store/workspace';
import { takeScreenshot as takeScreenshotRPC } from '/@/modules/rpc';
import { stripBase64ImagePrefix, resizeImage } from '/@/modules/image';
import { type CameraRPC } from '/@/modules/rpc/camera';

type Screenshot = {
  iframe: HTMLIFrameElement;
  camera?: CameraRPC;
};

export function useScene() {
  const dispatch = useDispatch();
  const [takeScreenshot] = throttle(takeScreenshotRPC, seconds(30), seconds(5));

  const updateTitle = useCallback(
    (project: Project, scene: Scene) => {
      const title = scene.display?.title || '';
      dispatch(workspaceActions.setProjectTitle({ path: project.path, title }));
    },
    [workspaceActions.setProjectTitle],
  );

  const updateThumbnail = useCallback(
    async (project: Project, { iframe, camera }: Screenshot) => {
      const screenshot = await takeScreenshot(iframe, camera);
      if (screenshot) {
        const thumbnail = await resizeImage(screenshot, 1024, 768);
        if (thumbnail) {
          dispatch(
            workspaceActions.saveThumbnail({
              path: project.path,
              thumbnail: stripBase64ImagePrefix(thumbnail),
            }),
          );
        }
      }
    },
    [workspaceActions.saveThumbnail],
  );

  return {
    updateTitle,
    updateThumbnail,
  };
}
