import React from 'react';
import { useAssetUrl } from './useAssetUrl';

interface AssetVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {}

/**
 * Component that renders videos from both external URLs and local scene assets.
 *
 * - For external URLs (http/https), the video is rendered directly.
 * - For local paths, the component fetches the file through the data layer and creates an object URL for rendering.
 *   All local paths are normalized to prevent directory traversal attacks.
 *
 * @param src - The video source URL or relative file path
 * @param props - Additional HTML video element attributes
 */
export const AssetVideo: React.FC<AssetVideoProps> = ({ src, ...props }) => {
  const videoSrc = useAssetUrl(src);

  if (!videoSrc) return null; // No video is shown on error or while loading.

  return (
    <video
      {...props}
      src={videoSrc}
      controls
      autoPlay={false}
    />
  );
};
