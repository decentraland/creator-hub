import React from 'react';
import { useAssetUrl } from './useAssetUrl';

interface AssetIframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {}

/**
 * Component that renders iframes from both external URLs and local scene assets.
 *
 * - For external URLs (http/https), the iframe is rendered directly.
 * - For local paths, the component fetches the file through the data layer and creates a blob URL for rendering.
 *   All local paths are normalized to prevent directory traversal attacks.
 *
 * Note: Local HTML files are loaded as blob URLs. This provides sandboxing but means relative links
 * within the HTML won't work for local assets.
 *
 * @param src - The iframe source URL or relative file path
 * @param props - Additional HTML iframe element attributes
 */
export const AssetIframe: React.FC<AssetIframeProps> = ({ src, ...props }) => {
  const iframeSrc = useAssetUrl(src);

  if (!iframeSrc) return null; // No iframe is shown on error or while loading.

  return (
    <div className="IframeContainer">
      <iframe
        {...props}
        src={iframeSrc}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};
