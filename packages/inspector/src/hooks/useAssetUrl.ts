import { useEffect, useState } from 'react';
import { getDataLayerInterface } from '../redux/data-layer';
import type { GetFileResponse } from '../lib/data-layer/remote-data-layer';
import {
  getMimeType,
  isExternalUrl,
  normalizePath,
} from '../components/SceneInfoPanel/MarkdownRenderer/utils';

/**
 * Hook that loads an asset from either an external URL or the scene filesystem
 * and returns a URL suitable for use in src attributes.
 *
 * For external URLs, returns the URL directly.
 * For local paths, loads the file via data layer and creates an object URL.
 *
 * Automatically cleans up object URLs on unmount.
 */
export function useAssetUrl(src: string | undefined): string | undefined {
  const [assetUrl, setAssetUrl] = useState<string | undefined>(() =>
    src && isExternalUrl(src) ? src : undefined,
  );

  useEffect(() => {
    if (!src) return;
    if (isExternalUrl(src)) {
      setAssetUrl(src);
      return;
    }

    let objectUrl: string | null = null;
    // Guards against the race where `src` changes (or the component unmounts)
    // while a load is in flight: without it, the resolved blob URL would be set
    // after cleanup (stale texture) and never revoked (leak).
    let cancelled = false;

    const loadAsset = async () => {
      try {
        // Security: Normalize the path to prevent directory traversal
        const path = normalizePath(src);

        // Get data layer interface
        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        // Fetch the file from the data layer
        const response: GetFileResponse = await dataLayer.getFile({ path });
        if (cancelled) return;

        // Convert Uint8Array to Blob with MIME type
        const type = getMimeType(path);
        const blob = new Blob([response.content as BlobPart], { type });

        // Create object URL
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

    // Cancel any in-flight load and revoke the object URL on unmount / src change.
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return assetUrl;
}
