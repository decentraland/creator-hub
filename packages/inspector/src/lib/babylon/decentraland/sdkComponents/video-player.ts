import * as BABYLON from '@babylonjs/core';
import type { PBVideoPlayer } from '@dcl/ecs';
import { ComponentType } from '@dcl/ecs';

import type { ComponentOperation } from '../component-operations';
import { withAssetPacksDir } from '../../../data-layer/host/fs-utils';
import { updateGltfForEntity } from './gltf-container';

export const putVideoPlayerComponent: ComponentOperation = async (entity, component) => {
  if (component.componentType !== ComponentType.LastWriteWinElementSet) {
    return;
  }

  const newValue = component.getOrNull(entity.entityId) as PBVideoPlayer | null;
  const context = entity.context.deref();

  let path: string | null = null;

  if (context) {
    const videoPlayerPath = withAssetPacksDir('video_player/video_player.glb');
    const videoScreenPath = withAssetPacksDir('video_screen/video_player.glb');

    const [videoPlayerFile, videoScreenFile] = await Promise.all([
      context.getFile(videoPlayerPath),
      context.getFile(videoScreenPath),
    ]);

    if (videoPlayerFile) {
      path = videoPlayerPath;
    } else if (videoScreenFile) {
      path = videoScreenPath;
    }
  }

  const gltfValue = newValue && path ? { src: path } : null;
  updateGltfForEntity(entity, gltfValue);

  const scaleMult = 1.55;

  try {
    await entity.onGltfContainerLoaded();

    if (entity.gltfAssetContainer) {
      // need to re-scale the model to get in sync with scale in preview...
      entity.gltfAssetContainer.meshes[0].scaling = new BABYLON.Vector3(
        // why negative X coordinate? => https://forum.babylonjs.com/t/left-and-right-handed-shenanagins/17049/4
        -0.2 * scaleMult,
        0.4 * scaleMult,
        0.1 * scaleMult,
      );
      entity.gltfAssetContainer.meshes[0].position = new BABYLON.Vector3(0, -0.5, 0);
    }
  } catch {
    // Silently handle errors
  }
};
