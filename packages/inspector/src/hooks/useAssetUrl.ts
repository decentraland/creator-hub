import { useEffect, useState } from 'react';
import { getDataLayerInterface } from '../redux/data-layer';
import type { GetFileResponse } from '../lib/data-layer/remote-data-layer';
import {
  getMimeType,
  isExternalUrl,
  normalizePath,
} from '../components/SceneInfoPanel/MarkdownRenderer/utils';
import { useAppSelector } from '../redux/hooks';
import { selectAssetCatalog } from '../redux/app';

/** Resolves an external URL or scene-fs path to a usable URL, re-resolving when the asset lands in the catalog. */
export function useAssetUrl(src: string | undefined): string | undefined {
  const [assetUrl, setAssetUrl] = useState<string | undefined>(() =>
    src && isExternalUrl(src) ? src : undefined,
  );

  const catalog = useAppSelector(selectAssetCatalog);
  const path = src && !isExternalUrl(src) ? normalizePath(src) : undefined;
  const inCatalog = !!path && !!catalog?.assets?.some(asset => normalizePath(asset.path) === path);

  useEffect(() => {
    if (!src) {
      setAssetUrl(undefined);
      return;
    }
    if (isExternalUrl(src)) {
      setAssetUrl(src);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadAsset = async () => {
      try {
        const resolved = normalizePath(src);

        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        const response: GetFileResponse = await dataLayer.getFile({ path: resolved });
        if (cancelled) return;

        const type = getMimeType(resolved);
        const blob = new Blob([response.content as BlobPart], { type });

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setAssetUrl(objectUrl);
      } catch (err) {
        console.error(`Failed to load asset URL for path: ${src}`, err);
      }
    };

    void loadAsset();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, inCatalog]);

  return assetUrl;
}
