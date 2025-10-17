import { useEffect, useState } from 'react';
import { getDataLayerInterface } from '../../../redux/data-layer';
import type { GetFileResponse } from '../../../lib/data-layer/remote-data-layer';
import { getMimeType, isExternalUrl, normalizePath } from './utils';

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

    const loadAsset = async () => {
      try {
        // Security: Normalize the path to prevent directory traversal
        const path = normalizePath(src);

        // Get data layer interface
        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        // Fetch the file from the data layer
        const response: GetFileResponse = await dataLayer.getFile({ path });

        // Convert Uint8Array to Blob with MIME type
        const type = getMimeType(path);
        const blob = new Blob([response.content as BlobPart], { type });

        // Create object URL
        objectUrl = URL.createObjectURL(blob);
        setAssetUrl(objectUrl);
      } catch (err) {
        console.error(`Failed to load asset on Scene Info: ${src}`, err);
      }
    };

    void loadAsset();

    // Cleanup object URL on unmount
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return assetUrl;
}
