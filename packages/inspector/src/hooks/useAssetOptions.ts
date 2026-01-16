import { useMemo } from 'react';

import { useAppSelector } from '../redux/hooks';
import { selectAssetCatalog } from '../redux/app';

export interface AssetOption {
  label: string;
  value: string;
}

/**
 * Hook that returns dropdown options from the asset catalog filtered by accepted extensions.
 *
 * @param accept - Array of accepted file extensions (e.g., ['.glb', '.gltf'])
 * @returns Array of options with label and value set to the asset path
 */
export function useAssetOptions(accept?: string[]): AssetOption[] {
  const catalog = useAppSelector(selectAssetCatalog);

  return useMemo(() => {
    if (!catalog?.assets) return [];

    const assets = catalog.assets;

    if (!accept || accept.length === 0) {
      return assets.map(({ path }) => ({ label: path, value: path }));
    }

    const normalizedExtensions = accept.map(ext => ext.toLowerCase());

    const results = assets
      .filter(({ path }) => {
        const lowerPath = path.toLowerCase();
        return normalizedExtensions.some(ext => lowerPath.endsWith(ext));
      })
      .map(({ path }) => ({ label: path, value: path }));

    return results;
  }, [catalog, accept]);
}
