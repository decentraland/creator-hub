import { Engine } from '@babylonjs/core/Engines/engine';

import { getDataLayerInterface } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { createLocalResolver, loadModelContainer } from '../AssetBrowserPreview/gltfResolver';
import { createPreviewScene, frameCamera, isColliderMesh } from '../AssetBrowserPreview/modelScene';
import { extractFileExtension } from '../ImportAsset/utils';

const SIZE = 192;
const MODEL_EXTENSIONS = ['glb', 'gltf'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg'];

const cache = new Map<string, Promise<string | undefined>>();

async function readAsset(path: string): Promise<Uint8Array> {
  const dataLayer = getDataLayerInterface();
  if (!dataLayer) throw new Error('Data layer is not ready');
  const { data } = await dataLayer.getAssetData({ path: withAssetDir(path) });
  return data;
}

async function renderImageThumbnail(path: string): Promise<string | undefined> {
  const data = await readAsset(path);
  const bitmap = await createImageBitmap(new Blob([data as BlobPart]));
  const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/png');
}

/**
 * One offscreen engine renders every model thumbnail, one at a time: browsers cap the number of
 * live WebGL contexts, and a folder full of models must not spawn one engine per tile.
 */
let renderer: ReturnType<typeof createRenderer> | undefined;

function createRenderer() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false });
  const { scene, camera } = createPreviewScene(engine);
  return { canvas, engine, scene, camera };
}

let queue: Promise<unknown> = Promise.resolve();

async function renderModelThumbnail(path: string): Promise<string | undefined> {
  const data = await readAsset(path);
  const extension = extractFileExtension(path)[1];
  renderer ??= createRenderer();
  const { canvas, scene, camera } = renderer;
  const container = await loadModelContainer(
    scene,
    data as BlobPart,
    extension,
    createLocalResolver(path),
  );
  container.meshes.filter(isColliderMesh).forEach(mesh => (mesh.isVisible = false));
  const hasGeometry = container.meshes.some(
    mesh => !isColliderMesh(mesh) && mesh.getTotalVertices() > 0,
  );
  if (!hasGeometry) {
    container.dispose();
    return undefined;
  }
  container.addAllToScene();
  container.animationGroups.forEach(group => group.stop());
  frameCamera(scene, camera);
  await scene.whenReadyAsync();
  scene.render();
  const thumbnail = canvas.toDataURL('image/png');
  container.dispose();
  return thumbnail;
}

/**
 * A small preview image for a local asset: the picture itself for images, a render for models.
 * Resolves to undefined for everything else, or when the file can't be decoded, so callers can
 * fall back to a type icon. Results are cached per path until `invalidateLocalThumbnail`.
 */
export function getLocalThumbnail(path: string): Promise<string | undefined> {
  const extension = extractFileExtension(path)[1];
  const isImage = IMAGE_EXTENSIONS.includes(extension);
  const isModel = MODEL_EXTENSIONS.includes(extension);
  if (!isImage && !isModel) return Promise.resolve(undefined);

  let result = cache.get(path);
  if (!result) {
    const render = isImage
      ? () => renderImageThumbnail(path)
      : () => {
          const next = queue.then(() => renderModelThumbnail(path));
          queue = next.catch(() => undefined);
          return next;
        };
    result = render().catch(error => {
      console.warn(`Could not generate a thumbnail for ${path}:`, error);
      return undefined;
    });
    cache.set(path, result);
  }
  return result;
}

export function invalidateLocalThumbnail(path: string) {
  cache.delete(path);
}
