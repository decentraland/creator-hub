import { useEffect, useState } from 'react';
import { getContentsUrl } from '../../lib/logic/catalog';
import { getDataLayerInterface } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { determineAssetType, extractFileExtension } from '../ImportAsset/utils';
import {
  createCatalogResolver,
  createLocalResolver,
  type DependencyResolver,
} from './gltfResolver';
import type { AssetSelection } from './selection';

export type PreviewKind = 'model' | 'image' | 'audio' | 'video' | 'script' | 'other';

export type PreviewSource = {
  kind: PreviewKind;
  name: string;
  extension: string;
  /** Object URL or remote URL the viewers can load. */
  url?: string;
  /** Raw file, only for local assets (needed to feed the emote viewer). */
  file?: File;
  /** Image shown when there is nothing live to render (custom items, failed models). */
  thumbnail?: string;
  size?: number;
  /** How to fetch the textures and buffers a model refers to. */
  resolveDependency?: DependencyResolver;
};

export type PreviewSourceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; source: PreviewSource }
  | { status: 'error' };

const MODEL_EXTENSIONS = ['glb', 'gltf'];

function kindFromExtension(extension: string): PreviewKind {
  switch (determineAssetType(extension)) {
    case 'Models':
      return 'model';
    case 'Images':
      return 'image';
    case 'Audio':
      return 'audio';
    case 'Video':
      return 'video';
    case 'Scripts':
      return 'script';
    default:
      return 'other';
  }
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resolves whatever is selected in the browser into something the viewers can render.
 * Object URLs created for local files are revoked when the selection changes.
 */
export function useAssetPreviewSource(selection?: AssetSelection): PreviewSourceState {
  const [state, setState] = useState<PreviewSourceState>({ status: 'idle' });

  useEffect(() => {
    if (!selection) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    if (selection.source === 'catalog') {
      const contents = selection.asset.contents;
      const modelKey = Object.keys(contents).find(key =>
        MODEL_EXTENSIONS.includes(extractFileExtension(key)[1]),
      );
      setState({
        status: 'ready',
        source: {
          kind: modelKey ? 'model' : 'image',
          name: selection.name,
          extension: modelKey ? extractFileExtension(modelKey)[1] : 'png',
          url: getContentsUrl(modelKey ? contents[modelKey] : contents['thumbnail.png']),
          thumbnail: contents['thumbnail.png']
            ? getContentsUrl(contents['thumbnail.png'])
            : undefined,
          resolveDependency: modelKey ? createCatalogResolver(contents, modelKey) : undefined,
        },
      });
      return;
    }

    if (selection.source === 'custom') {
      setState({
        status: 'ready',
        source: {
          kind: 'image',
          name: selection.name,
          extension: 'png',
          url: selection.asset.thumbnail,
          thumbnail: selection.asset.thumbnail,
        },
      });
      return;
    }

    const extension = extractFileExtension(selection.name)[1];
    const kind = kindFromExtension(extension);
    if (kind === 'script' || kind === 'other') {
      setState({ status: 'ready', source: { kind, name: selection.name, extension } });
      return;
    }

    setState({ status: 'loading' });
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) {
      setState({ status: 'error' });
      return;
    }
    dataLayer
      .getAssetData({ path: withAssetDir(selection.path) })
      .then(({ data }) => {
        if (cancelled) return;
        const file = new File([data as BlobPart], selection.name);
        objectUrl = URL.createObjectURL(file);
        setState({
          status: 'ready',
          source: {
            kind,
            name: selection.name,
            extension,
            url: objectUrl,
            file,
            size: data.byteLength,
            resolveDependency: kind === 'model' ? createLocalResolver(selection.path) : undefined,
          },
        });
      })
      .catch(error => {
        console.error('Could not load asset preview:', error);
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selection]);

  return state;
}
