import type { DataLayerRpcClient } from './types';

type RemoveAssetsClient = Pick<DataLayerRpcClient, 'removeAssets' | 'removeAsset'>;

/** A one-by-one removal that stopped early; `removed` lists the paths that are gone. */
export class PartialRemovalError extends Error {
  constructor(
    readonly removed: string[],
    readonly cause: unknown,
  ) {
    super(`Removed ${removed.length} file(s) before failing`);
  }
}

/**
 * Removes `paths` in one undoable batch, or one by one on hosts without the batch method.
 * @returns the removed paths
 * @throws PartialRemovalError when the one-by-one fallback fails partway
 */
export async function removeAssetFiles(
  dataLayer: RemoveAssetsClient,
  paths: string[],
): Promise<string[]> {
  if (!paths.length) return [];
  try {
    await dataLayer.removeAssets({ paths });
    return paths;
  } catch (error) {
    console.warn('Batch asset removal is not available, removing the files one by one', error);
  }
  const removed: string[] = [];
  for (const path of paths) {
    try {
      await dataLayer.removeAsset({ path });
    } catch (error) {
      throw new PartialRemovalError(removed, error);
    }
    removed.push(path);
  }
  return removed;
}

/** `removeAssetFiles` that never throws: the paths that are gone, plus the error when it failed. */
export async function removeAssetFilesSettled(
  dataLayer: RemoveAssetsClient,
  paths: string[],
): Promise<{ removed: string[]; error?: unknown }> {
  try {
    return { removed: await removeAssetFiles(dataLayer, paths) };
  } catch (error) {
    return { removed: error instanceof PartialRemovalError ? error.removed : [], error };
  }
}
