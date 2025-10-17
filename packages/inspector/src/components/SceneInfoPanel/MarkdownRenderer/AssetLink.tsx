import React, { useCallback } from 'react';
import { useAppDispatch } from '../../../redux/hooks';
import { openFile } from '../../../redux/data-layer';
import { isExternalUrl, normalizePath } from './utils';

interface AssetLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

/**
 * Component that handles links in markdown, supporting both external URLs and local file paths.
 *
 * - For external URLs (http/https), opens in a new tab
 * - For local file paths, dispatches Redux action to open the file in the user's preferred editor
 *
 * @param href - The link URL or relative file path
 * @param props - Additional HTML anchor element attributes
 */
export const AssetLink: React.FC<AssetLinkProps> = ({ href, children, ...props }) => {
  const dispatch = useAppDispatch();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!href) return;

      // For external URLs, let the browser handle it normally
      if (isExternalUrl(href)) return;

      // For local paths, prevent default and dispatch Redux action
      e.preventDefault();
      const normalizedHref = normalizePath(href);
      dispatch(openFile({ path: normalizedHref }));
    },
    [href, dispatch],
  );

  return (
    <a
      {...props}
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};
