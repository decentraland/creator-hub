import { useEffect, useState } from 'react';
import { getDataLayerInterface } from '../redux/data-layer';
import type { GetFileResponse } from '../lib/data-layer/remote-data-layer';
import {
  getMimeType,
  isExternalUrl,
  normalizePath,
} from '../components/SceneInfoPanel/MarkdownRenderer/utils';

/** Resolves an external URL or scene-filesystem path to a URL usable in `src`, revoking any object URL on unmount. */
export function useAssetUrl(src: string | undefined): string | undefined {
  const [assetUrl, setAssetUrl] = useState<string | undefined>(() =>
    src && isExternalUrl(src) ? src : undefined,
  );

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
        const path = normalizePath(src);

        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        const response: GetFileResponse = await dataLayer.getFile({ path });
        if (cancelled) return;

        const type = getMimeType(path);
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
  }, [src]);

  return assetUrl;
}
