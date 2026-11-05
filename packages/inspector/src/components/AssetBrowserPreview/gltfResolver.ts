import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { registerGLTFExtension } from '@babylonjs/loaders/glTF/2.0';
import '@babylonjs/loaders/glTF';

import { getContentsUrl } from '../../lib/logic/catalog';
import { getDataLayerInterface } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';

/** Serves the files a glTF refers to (textures, .bin buffers) when it is loaded in isolation. */
export type DependencyResolver = (uri: string) => Promise<Uint8Array>;

const PREVIEW_FILE_RESOLVER = 'PREVIEW_file_resolver';
const resolvers = new Map<string, DependencyResolver>();
let nextLoad = 0;

// A glb only carries self-contained bytes when its textures are embedded. The asset-pack catalog
// and scene folders keep them as sibling files instead, so every preview load names its file and
// registers a resolver under that name. `_loadUriAsync` is consulted before the scene renderer's
// own resolver (which only answers for files carrying `?base=`), so the two never collide.
registerGLTFExtension(PREVIEW_FILE_RESOLVER, false, loader => ({
  name: PREVIEW_FILE_RESOLVER,
  enabled: true,
  dispose: () => {},
  _loadUriAsync: (_context: string, _property: unknown, uri: string) => {
    if (uri.startsWith('data:')) return null;
    const resolve = resolvers.get((loader as any)._fileName as string);
    return resolve ? resolve(uri) : null;
  },
}));

export async function loadModelContainer(
  scene: Scene,
  data: BlobPart,
  extension: string,
  resolve?: DependencyResolver,
): Promise<AssetContainer> {
  const isGltf = extension === 'gltf';
  const name = `preview-${nextLoad++}.${isGltf ? 'gltf' : 'glb'}`;
  const file = new File([data], name);
  if (resolve) resolvers.set(name, resolve);
  try {
    return await SceneLoader.LoadAssetContainerAsync(
      '',
      file,
      scene,
      undefined,
      isGltf ? '.gltf' : '.glb',
    );
  } finally {
    resolvers.delete(name);
  }
}

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
}

/** Resolves a model's dependencies against its own folder in the project. */
export function createLocalResolver(modelPath: string): DependencyResolver {
  const folder = modelPath.includes('/') ? modelPath.slice(0, modelPath.lastIndexOf('/')) : '';
  return async uri => {
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) throw new Error('Data layer is not ready');
    const path = normalizePath(`${folder}/${decodeURIComponent(uri)}`);
    const { data } = await dataLayer.getAssetData({ path: withAssetDir(path) });
    return data;
  };
}

/**
 * Resolves a model's dependencies through the asset pack's `contents` (file path -> hash).
 * Packs keep a model's textures beside it (`Rock_03/Rock_03.glb`, `Rock_03/Pack_TX.png`), so a URI
 * is looked up relative to the model's own folder first.
 */
export function createCatalogResolver(
  contents: Record<string, string>,
  modelKey: string,
): DependencyResolver {
  const folder = modelKey.includes('/') ? modelKey.slice(0, modelKey.lastIndexOf('/')) : '';
  const byLowerPath = new Map(
    Object.entries(contents).map(([key, hash]) => [key.toLowerCase(), hash]),
  );
  return async uri => {
    const decoded = decodeURIComponent(uri);
    const basename = decoded.split('/').pop() ?? decoded;
    const candidates = [normalizePath(`${folder}/${decoded}`), decoded, basename];
    const hash = candidates
      .flatMap(candidate => [contents[candidate], byLowerPath.get(candidate.toLowerCase())])
      .find(Boolean);
    if (!hash) throw new Error(`Asset pack has no file for "${uri}"`);
    const response = await fetch(getContentsUrl(hash));
    if (!response.ok) throw new Error(`Could not fetch "${uri}" (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  };
}
