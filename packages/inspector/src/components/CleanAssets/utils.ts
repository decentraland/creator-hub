import { getPayload, type Action, type Actions } from '@dcl/asset-packs';
import type { ActionType } from '@dcl/asset-packs';
import type { SdkContextValue } from '../../lib/sdk/context';
import { DIRECTORY, EXTENSIONS } from '../../lib/data-layer/host/fs-utils';
import type { IDataLayer } from '../../redux/data-layer';
import { determineAssetType, getGltf } from '../ImportAsset/utils';
import type { Gltf } from '../ImportAsset/types';
import type { AssetFile, FileSize } from './types';

function isValidAssetPath(path: string): boolean {
  return (
    path.startsWith(DIRECTORY.ASSETS) && EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext))
  );
}

function isModelAsset(path: string): boolean {
  const assetExtension = path.split('.').pop()?.toLowerCase() || '';
  return determineAssetType(assetExtension) === 'Models';
}
function getFileNameAndDirectory(path: string): [string, string] {
  const parts = path.split('/');
  const fileName = parts.pop() || ''; // Removes file name from parts
  const dir = parts.join('/');
  return [dir, fileName];
}

/**
 * Recursively scans an object looking for strings that match asset paths
 * @param obj The object to scan
 * @param addAsset Callback to add found asset paths
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

    const normalized = (path.startsWith('/') ? path.slice(1) : path).toLowerCase();
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
 * Extracts all external resource paths referenced by a glTF model
 * @param gltf The parsed glTF data
 * @returns List of normalized asset paths referenced by the model
 */
function extractModelReferencedAssets(gltf: Gltf): string[] {
  const referencedAssets: string[] = [];

  // Extract external resources (buffers, images, etc.)
  if (Array.isArray(gltf.info?.resources)) {
    gltf.info.resources.forEach(resource => {
      if (resource.storage === 'external' && resource.uri) {
        referencedAssets.push(resource.uri.toLowerCase());
      }
    });
  }

  return referencedAssets;
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
  dataLayer: IDataLayer,
): Promise<AssetFile[]> {
  const usedAssets = collectUsedAssets(sdk); // Get all assets referenced in the scene

  // Analyze used model assets to find referenced external resources
  for (const filePath of usedAssets) {
    if (isModelAsset(filePath)) {
      try {
        if (!dataLayer) continue;

        const fileResponse = await dataLayer.getFile({ path: filePath });
        const [modelDir, fileName] = getFileNameAndDirectory(filePath);
        const fileObject = new File([new Uint8Array(fileResponse.content)], fileName);

        const getExternalResource = async (uri: string): Promise<Uint8Array> => {
          try {
            const resourcePath = `${modelDir}/${uri}`;
            const resourceResponse = await dataLayer.getFile({ path: resourcePath });
            return new Uint8Array(resourceResponse.content);
          } catch (error) {
            console.warn(`Failed to load external resource: ${uri}`, error);
            throw error;
          }
        };

        // Parse the glTF and extract referenced assets
        const gltf = await getGltf(fileObject, getExternalResource);
        const referencedPaths = extractModelReferencedAssets(gltf);

        referencedPaths.forEach(path => {
          usedAssets.add(`${modelDir}/${path}`.toLowerCase());
        });
      } catch (error) {
        console.error(`Error processing model asset: ${filePath}`, error);
      }
    }
  }

  const results: AssetFile[] = allFiles.map(file => ({
    path: file.path,
    size: file.size,
    unused: !usedAssets.has(file.path.toLowerCase()),
  }));

  // Sort by type (unused files first) and size descending (largest files first)
  results.sort((a, b) => (a.unused === b.unused ? b.size - a.size : a.unused ? -1 : 1));

  return results;
}
