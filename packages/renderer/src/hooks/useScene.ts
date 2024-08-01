import { useCallback } from 'react';
import { type Scene } from '@dcl/schemas';

import { useDispatch } from '#store';

import type { Project } from '/shared/types/projects';
import { throttle } from '/shared/utils';
import { seconds } from '/shared/time';

import { actions as workspaceActions } from '/@/modules/store/workspace';
import { stripBase64ImagePrefix, resizeImage } from '/@/modules/image';
import { type CameraClient } from '/@/modules/server/camera';

type Screenshot = {
  iframe: HTMLIFrameElement;
  camera: CameraClient;
};

export function useScene() {
  const dispatch = useDispatch();
  const [takeScreenshot] = throttle(
    async (target: HTMLIFrameElement, camera: CameraClient) => {
      // TODO:
      // 1. make the camera position/target relative to parcels rows & columns
      // 2. the CameraServer only allows to reposition the main camera, so repositioning it, will also
      //    reposition the content creator's view. We need a way to specify a different camera or a way to
      //    save the current position, move it for a screenshot, and restore it
      //
      // leaving the next line just for reference:
      // await Promise.all([camera.setPosition(x, y, z), camera.setTarget(x, y, z)]);

      const screenshot = await camera.takeScreenshot(+target.width, +target.height);
      return screenshot;
    },
    seconds(30),
    seconds(5),
  );

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
