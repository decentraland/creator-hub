import { getPayload, type Action, type Actions } from '@dcl/asset-packs';
import type { ActionType } from '@dcl/asset-packs';
import type { SdkContextValue } from '../../lib/sdk/context';
import { DIRECTORY, EXTENSIONS } from '../../lib/data-layer/host/fs-utils';
import type { IDataLayer } from '../../redux/data-layer';
import type { DataLayerRpcClient } from '../../lib/data-layer/types';
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

function isCompositeAsset(path: string): boolean {
  return path.endsWith('composite.json');
}

/**
 * Gets the file name and directory from a file path.
 * @param path The file path to extract information from.
 * @returns A tuple containing the directory and file name.
 */
function getDirectoryAndFileName(path: string): [string, string] {
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
  if (!Array.isArray(gltf.info?.resources)) return [];

  // Extract external resources paths (buffers, images, etc.)
  return gltf.info.resources
    .filter(
      (resource): resource is typeof resource & { uri: string } =>
        resource.storage === 'external' && !!resource.uri,
    )
    .map(resource => resource.uri.toLowerCase());
}

/**
 * Extracts all asset paths referenced by a composite.json file
 * @param composite The parsed composite.json data
 * @param baseDir The directory path of the composite file
 * @returns List of normalized asset paths referenced by the composite
 */
function extractCompositeReferencedAssets(composite: any, baseDir: string): string[] {
  const referencedAssets: string[] = [];

  if (!composite || !composite.components || !Array.isArray(composite.components)) {
    return referencedAssets;
  }

  const addAsset = (path: string) => {
    if (typeof path !== 'string' || !path) return;

    const resolvedPath = (path.startsWith('/') ? path.slice(1) : path)
      .replace('{assetPath}', baseDir)
      .toLowerCase();

    if (resolvedPath && isValidAssetPath(resolvedPath)) {
      referencedAssets.push(resolvedPath);
    }
  };

  composite.components.forEach((component: { data: Record<string, { json: any }> }) =>
    scanObjectForAssets(component.data, addAsset),
  );

  return referencedAssets;
}

/**
 * Processes composite.json files to determine if they should be marked as used
 * @param usedAssets The set of used assets to update
 * @param allFiles The list of all asset files
 * @param dataLayer The data layer interface
 */
async function processCompositeAssets(
  usedAssets: Set<string>,
  allFiles: FileSize[],
  dataLayer: DataLayerRpcClient,
): Promise<void> {
  const unusedCompositePaths = allFiles
    .filter(file => !usedAssets.has(file.path.toLowerCase()) && isCompositeAsset(file.path))
    .map(file => file.path.toLowerCase());

  if (unusedCompositePaths.length === 0) return;

  const { files } = await dataLayer.getFilesList({ paths: unusedCompositePaths });

  await Promise.all(
    files.map(async file => {
      if (!file.success) return;

      try {
        const [baseDir] = getDirectoryAndFileName(file.path);
        const compositeContent = new TextDecoder().decode(file.content);
        const composite = JSON.parse(compositeContent);

        const referencedPaths = extractCompositeReferencedAssets(composite, baseDir);
        const hasUsedAssets = referencedPaths.some(path => usedAssets.has(path.toLowerCase()));

        if (hasUsedAssets) {
          usedAssets.add(file.path.toLowerCase());
        }
      } catch (error) {
        console.error(`[CleanAssets] Error processing composite asset: ${file.path}`, error);
        usedAssets.add(file.path.toLowerCase()); // Mark as used anyway to avoid removing it just in case it's in use.
      }
    }),
  );
}

/** Processes model assets to find and mark their referenced external resources as used */
async function processModelAssets(
  usedAssets: Set<string>,
  dataLayer: DataLayerRpcClient,
): Promise<void> {
  const filePaths = Array.from(usedAssets.values()).filter(path => isModelAsset(path));
  if (filePaths.length === 0) return;

  const { files } = await dataLayer.getFilesList({ paths: filePaths });

  await Promise.all(
    files.map(async file => {
      if (!file.success) return;
      try {
        const [baseDir, fileName] = getDirectoryAndFileName(file.path);
        const fileObject = new File([new Uint8Array(file.content)], fileName);

        // Parse the glTF and extract referenced assets.
        // We don't need to fetch the external files contents, just return a placeholder.
        const gltf = await getGltf(fileObject, async () => new Uint8Array());
        const referencedPaths = extractModelReferencedAssets(gltf);

        referencedPaths.forEach(path => {
          usedAssets.add(`${baseDir}/${path}`.toLowerCase());
        });
      } catch (error) {
        console.error(`Error processing model asset: ${file.path}`, error);
      }
    }),
  );
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

  if (dataLayer) {
    await Promise.all([
      processModelAssets(usedAssets, dataLayer),
      processCompositeAssets(usedAssets, allFiles, dataLayer),
    ]);
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
