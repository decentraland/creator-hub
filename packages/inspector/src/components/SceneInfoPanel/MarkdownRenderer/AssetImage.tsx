import React from 'react';
import { useAssetUrl } from './useAssetUrl';

interface AssetImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

/**
 * Component that renders images from both external URLs and local scene assets.
 *
 * - For external URLs (http/https), the image is rendered directly.
 * - For local paths, the component fetches the file through the data layer and creates an object URL for rendering.
 *   All local paths are normalized to prevent directory traversal attacks.
 *
 * @param src - The image source URL or relative file path
 * @param props - Additional HTML img element attributes
 */
export const AssetImage: React.FC<AssetImageProps> = ({ src, alt, ...props }) => {
  const imageSrc = useAssetUrl(src);

  if (!imageSrc) return null; // No image is shown on error or while loading.

  return (
    <img
      src={imageSrc}
      alt={alt || ''}
      {...props}
    />
  );
};
