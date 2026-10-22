import { useEffect, useState } from 'react';
import { getContentsUrl } from '../../lib/logic/catalog';
import { getDataLayerInterface } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { determineAssetType, extractFileExtension } from '../ImportAsset/utils';
import { fetchBaseEmoteFile, getBuiltInPreviewEmote } from './baseEmotes';
import {
  createCatalogResolver,
  createLocalResolver,
  type DependencyResolver,
} from './gltfResolver';
import type { AssetSelection } from './selection';

export type PreviewKind =
  | 'model'
  | 'image'
  | 'audio'
  | 'video'
  | 'script'
  | 'emote'
  | 'custom'
  | 'other';

export type PreviewSource = {
  kind: PreviewKind;
  name: string;
  extension: string;
  /** Object URL or remote URL the viewers can load. */
  url?: string;
  /** Raw file: local assets, and built-in animations fetched as base emotes (both feed the emote viewer). */
  file?: File;
  /** Image shown when there is nothing live to render (custom items, failed models). */
  thumbnail?: string;
  size?: number;
  /** A built-in animation the avatar preview can play by name. */
  builtInEmote?: string;
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

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')} min`;
}

type Resolved = { selection: AssetSelection | undefined; state: PreviewSourceState };

/**
 * Resolves whatever is selected in the browser into something the viewers can render.
 * Object URLs created for local files are revoked when the selection changes.
 */
export function useAssetPreviewSource(selection?: AssetSelection): PreviewSourceState {
  const [resolved, setResolved] = useState<Resolved>({
    selection: undefined,
    state: { status: 'idle' },
  });

  useEffect(() => {
    const setState = (state: PreviewSourceState) => setResolved({ selection, state });
    if (!selection) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    const builtIn =
      selection.source === 'catalog'
        ? selection.asset.builtInEmote && {
            name: selection.asset.builtInEmote,
            thumbnailUrl: getContentsUrl(selection.asset.contents['thumbnail.png']),
            previewUrl: selection.asset.contents['preview.webp']
              ? getContentsUrl(selection.asset.contents['preview.webp'])
              : undefined,
          }
        : selection.source === 'local'
          ? selection.builtInEmote
          : undefined;

    if (builtIn) {
      const base: PreviewSource = {
        kind: 'emote',
        name: selection.name,
        extension: 'webp',
        url: builtIn.previewUrl ?? builtIn.thumbnailUrl,
        thumbnail: builtIn.thumbnailUrl,
        builtInEmote: builtIn.name,
      };
      if (getBuiltInPreviewEmote(builtIn.name)) {
        setState({ status: 'ready', source: base });
        return;
      }
      setState({ status: 'loading' });
      void fetchBaseEmoteFile(builtIn.name).then(file => {
        if (!cancelled) setState({ status: 'ready', source: { ...base, file } });
      });
      return () => {
        cancelled = true;
      };
    }

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
          // File-less animations (built-ins) only ship an animated preview.
          extension: modelKey ? extractFileExtension(modelKey)[1] : 'webp',
          url: getContentsUrl(
            modelKey ? contents[modelKey] : (contents['preview.webp'] ?? contents['thumbnail.png']),
          ),
          thumbnail: contents['thumbnail.png']
            ? getContentsUrl(contents['thumbnail.png'])
            : undefined,
          resolveDependency: modelKey ? createCatalogResolver(contents, modelKey) : undefined,
        },
      });
      return;
    }

    // A custom item can hold several entities and models, so only its thumbnail is shown.
    if (selection.source === 'custom') {
      setState({
        status: 'ready',
        source: {
          kind: 'custom',
          name: selection.name,
          extension: '',
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

  // Until the effect has run for the current selection, the stored state still describes the
  // previous one; handing that out would start loading the old asset under the new selection.
  if (resolved.selection === selection) return resolved.state;
  return selection ? { status: 'loading' } : { status: 'idle' };
}
