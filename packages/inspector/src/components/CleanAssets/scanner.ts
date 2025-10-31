import { getPayload, type Action, type Actions } from '@dcl/asset-packs';
import type { ActionType } from '@dcl/asset-packs';
import type { SdkContextValue } from '../../lib/sdk/context';
import { DIRECTORY, EXTENSIONS } from '../../lib/data-layer/host/fs-utils';
import type { AssetFile, FileSize } from './types';

function isValidAssetPath(path: string): boolean {
  return (
    path.startsWith(DIRECTORY.ASSETS) && EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext))
  );
}

/**
 * Recursively scans an object looking for strings that match asset paths
 * @param obj The object to scan
 * @param addAsset Callback to add found asset paths
 * @param visited Set to track visited objects and avoid circular references
 */
function scanObjectForAssets(obj: any, addAsset: (path: string) => void): void {
  // Base case
  if (typeof obj === 'string') {
    addAsset(obj);
    return;
  }

  // Recursion case
  if (typeof obj === 'object' && obj !== null) {
    // Handle plain objects and arrays
    for (const value of Object.values(obj)) {
      scanObjectForAssets(value, addAsset);
    }
  }
}

/**
 * Collects all asset file paths referenced in the scene by recursively
 * scanning all components for asset path strings
 * @param sdk The SDK context
 * @returns A Set of asset paths that are in use
 */
export function collectUsedAssets(sdk: SdkContextValue): Set<string> {
  const usedAssets = new Set<string>();
  const { engine, components } = sdk;

  /** Helper to normalize and add asset path */
  const addAsset = (path: string) => {
    if (typeof path !== 'string' || !path) return;

    const normalized = path.startsWith('/') ? path.slice(1) : path;
    if (normalized && isValidAssetPath(normalized)) {
      usedAssets.add(normalized);
    }
  };

  // Scan all entities and their components
  for (const componentDef of Object.values(components)) {
    try {
      // Get all entities that have this component
      for (const [entity] of engine.getEntitiesWith(componentDef)) {
        const componentData = componentDef.getOrNull(entity);
        if (componentData) {
          // Special handling for Actions component (needs payload parsing)
          if (componentDef === components.Actions) {
            const actionsData = componentData as Actions;
            if (actionsData.value) {
              for (const action of actionsData.value) {
                try {
                  const payload = getPayload<ActionType>(action as Action);
                  if (payload) {
                    scanObjectForAssets(payload, addAsset);
                  }
                } catch (e) {
                  // Failed to parse action payload, skip it
                }
              }
            }
          } else {
            // Generic scan for all other components
            scanObjectForAssets(componentData, addAsset);
          }
        }
      }
    } catch (e) {
      // Failed to iterate entities with this component, just skip it.
      console.warn('Error scanning component:', e);
    }
  }

  return usedAssets;
}

/**
 * Scans the project and identifies unused assets
 * @param sdk The SDK context
 * @param allFiles The list of all asset files with their sizes
 * @returns Array of AssetFile objects with unused flag set
 */
export async function scanForUnusedAssets(
  sdk: SdkContextValue,
  allFiles: FileSize[],
): Promise<AssetFile[]> {
  const usedAssets = collectUsedAssets(sdk); // Get all assets referenced in the scene

  const results: AssetFile[] = allFiles.map(file => ({
    path: file.path,
    size: file.size,
    unused: !usedAssets.has(file.path),
  }));

  // Sort by size descending (largest files first)
  results.sort((a, b) => b.size - a.size);

  return results;
}
