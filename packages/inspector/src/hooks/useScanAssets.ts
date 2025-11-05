import { useState, useCallback } from 'react';
import { DIRECTORY } from '../lib/data-layer/host/fs-utils';
import { getDataLayerInterface } from '../redux/data-layer';
import { scanForUnusedAssets } from '../components/CleanAssets/utils';
import type { AssetFile } from '../components/CleanAssets/types';
import { useSdk } from './sdk/useSdk';

/**
 * Default patterns that should always be ignored when scanning for unused assets.
 * These patterns mirror the .dclignore functionality from the SDK toolchain.
 * @see https://github.com/decentraland/js-sdk-toolchain/blob/main/packages/%40dcl/sdk-commands/src/logic/dcl-ignore.ts
 */
export const DEFAULT_DCL_IGNORE_PATTERNS = [
  '.*',
  'package.json',
  'package-lock.json',
  'yarn-lock.json',
  'build.json',
  'export',
  'tsconfig.json',
  'tslint.json',
  'node_modules',
  'dclcontext',
  '**/*.ts',
  '**/*.tsx',
  'Dockerfile',
  'thumbnails',
  'dist',
  'README.md',
  '*.blend',
  '*.fbx',
  '*.zip',
  '*.rar',
];

/**
 * Reads the .dclignore file from the scene root and parses it into an array of patterns.
 *
 * @param dataLayer - Data layer RPC client
 * @returns Array of ignore patterns from .dclignore file, or default patterns if file doesn't exist
 */
async function getDclIgnorePatterns(
  dataLayer: ReturnType<typeof getDataLayerInterface>,
): Promise<string[]> {
  if (!dataLayer) return DEFAULT_DCL_IGNORE_PATTERNS;

  try {
    const response = await dataLayer.getFile({ path: '.dclignore' });
    const content = Buffer.from(response.content).toString('utf-8');

    // Parse the file: split by lines and filter out empty lines and comments
    const patterns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    return patterns.length > 0 ? patterns : DEFAULT_DCL_IGNORE_PATTERNS;
  } catch (error) {
    // File doesn't exist or can't be read, just return default patterns
    return DEFAULT_DCL_IGNORE_PATTERNS;
  }
}

export interface UseCleanAssetsResult {
  assets: AssetFile[];
  isScanning: boolean;
  scanAssets: () => Promise<AssetFile[]>;
}

/**
 * Hook to handle scanning for unused assets in a Decentraland scene.
 * This hook encapsulates the logic for scanning the file system and identifying
 * which assets are not referenced in the scene.
 *
 * @param ignoredPatterns - Additional patterns to ignore beyond the default .dclignore patterns
 * @returns An object containing the scanned assets, scanning state, and scan function
 */
export function useScanAssets(ignoredPatterns: string[] = []): UseCleanAssetsResult {
  const sdk = useSdk();
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<AssetFile[]>([]);

  const scanAssets = useCallback(async () => {
    if (!sdk) return [];

    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return [];

    let assets: AssetFile[] = [];
    try {
      setIsScanning(true);

      const dclIgnorePatterns = await getDclIgnorePatterns(dataLayer);
      const allIgnoredPatterns = [...dclIgnorePatterns, ...ignoredPatterns];
      const uniquePatterns = Array.from(new Set(allIgnoredPatterns)); // Remove duplicates

      const { files } = await dataLayer.getFilesSizes({
        path: DIRECTORY.ASSETS,
        ignore: uniquePatterns,
      });

      if (files.length > 0) {
        assets = scanForUnusedAssets(sdk, files);
      }
    } catch (err) {
      console.error('Error scanning assets:', err);
    } finally {
      setAssets(assets);
      setIsScanning(false);
    }
    return assets;
  }, [sdk, ignoredPatterns]);

  return {
    assets,
    isScanning,
    scanAssets,
  };
}
