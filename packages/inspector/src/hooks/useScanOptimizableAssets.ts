import { useState, useCallback } from 'react';
import { getDataLayerInterface } from '../redux/data-layer';
import { scanForOptimizableAssets } from '../components/OptimizeAssets/utils';
import type { OptimizableAsset } from '../components/OptimizeAssets/types';
import { DEFAULT_DCL_IGNORE_PATTERNS } from './useScanAssets';

export interface UseScanOptimizableAssetsResult {
  assets: OptimizableAsset[];
  isScanning: boolean;
  scanAssets: () => Promise<OptimizableAsset[]>;
}

export function useScanOptimizableAssets(): UseScanOptimizableAssetsResult {
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<OptimizableAsset[]>([]);

  const scanAssets = useCallback(async () => {
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return [];

    let result: OptimizableAsset[] = [];
    try {
      setIsScanning(true);
      result = await scanForOptimizableAssets(dataLayer, DEFAULT_DCL_IGNORE_PATTERNS);
    } catch (err) {
      console.error('Error scanning optimizable assets:', err);
    } finally {
      setAssets(result);
      setIsScanning(false);
    }
    return result;
  }, []);

  return {
    assets,
    isScanning,
    scanAssets,
  };
}
