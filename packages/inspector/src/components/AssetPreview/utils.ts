import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { BodyShape, EmoteCategory, WearableCategory } from '@dcl/schemas';
import type { EmoteWithBlobs, WearableWithBlobs } from '@dcl/schemas';
import '@babylonjs/loaders/glTF';

import { isEmoteContainer } from './emote';

export function toWearableWithBlobs(file: File, resources: File[] = []): WearableWithBlobs {
  return {
    id: file.name,
    name: '',
    description: '',
    image: '',
    thumbnail: '',
    i18n: [],
    data: {
      category: WearableCategory.HAT,
      hides: [],
      replaces: [],
      tags: [],
      representations: [
        {
          bodyShapes: [BodyShape.MALE, BodyShape.FEMALE],
          mainFile: file.name,
          contents: [
            {
              key: file.name,
              blob: file,
            },
            ...resources.map(resource => ({
              key: resource.name,
              blob: resource,
            })),
          ],
          overrideHides: [],
          overrideReplaces: [],
        },
      ],
    },
  };
}

export function toEmoteWithBlobs(file: File, resources: File[] = []): EmoteWithBlobs {
  return {
    id: file.name,
    name: file.name,
    description: '',
    image: '',
    thumbnail: '',
    i18n: [],
    emoteDataADR74: {
      category: EmoteCategory.DANCE,
      tags: [],
      representations: [
        {
          bodyShapes: [BodyShape.MALE, BodyShape.FEMALE],
          mainFile: file.name || 'model.glb',
          contents: [
            {
              key: file.name,
              blob: file,
            },
            ...(resources || []).map(resource => ({
              key: resource.name,
              blob: resource,
            })),
          ],
        },
      ],
      loop: false,
    },
  };
}

const DETECTION_TIMEOUT = 30_000;

/**
 * Whether a file is an emote, by loading it and inspecting its rig.
 *
 * The import dialog awaits one of these per selected file before it renders anything, so a load
 * that never settles would leave the modal permanently empty with nothing logged. The loader has
 * no timeout of its own, so it races one that rejects into the catch below — `false` is the safe
 * default either way, since it only means the file is treated as an ordinary model.
 */
export async function isEmote(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  const engine = new Engine(canvas, false);
  const scene = new Scene(engine);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      SceneLoader.LoadAssetContainerAsync(
        '',
        url,
        scene,
        undefined,
        file.name.endsWith('.gltf') ? '.gltf' : '.glb',
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${DETECTION_TIMEOUT}ms`)),
          DETECTION_TIMEOUT,
        );
      }),
    ]);

    return isEmoteContainer(result);
  } catch (err) {
    console.error('Error checking if file is emote:', err);
    return false;
  } finally {
    clearTimeout(timeout);
    URL.revokeObjectURL(url);
    scene.dispose();
    engine.dispose();
  }
}
