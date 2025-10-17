import React, { useEffect, useState } from 'react';
import { getDataLayerInterface } from '../../../redux/data-layer';
import type { GetFileResponse } from '../../../lib/data-layer/remote-data-layer';
import { getMimeType, isExternalUrl, normalizePath } from '../utils';

interface AssetImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

/**
 * Component that renders images from both external URLs and local scene assets.
 *
 * - For external URLs (http/https), the image is rendered directly.
 * - For local paths, the component fetches the file through the data layer and creates an object URL for rendering.
 *  All local paths are normalized to prevent directory traversal attacks.
 *
 * @param src - The image source URL or relative file path
 * @param props - Additional HTML img element attributes
 */
export const AssetImage: React.FC<AssetImageProps> = ({ src, alt, ...props }) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(() =>
    isExternalUrl(src) ? src : undefined,
  );

  useEffect(() => {
    if (!src) return;
    if (isExternalUrl(src)) {
      setImageSrc(src);
      return;
    }

    let objectUrl: string | null = null;

    const loadImage = async () => {
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
        setImageSrc(objectUrl);
      } catch (err) {
        console.error(`Failed to load image on Scene Info: ${src}`, err);
      }
    };

    if (src) {
      void loadImage();
    }

    // Cleanup object URL on unmount
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!imageSrc) return null; // No image is shown on error or while loading.

  return (
    <img
      src={imageSrc}
      alt={alt || ''}
      {...props}
    />
  );
};
