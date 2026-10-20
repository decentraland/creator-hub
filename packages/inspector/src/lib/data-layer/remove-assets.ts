import type { DataLayerRpcClient } from './types';

type RemoveAssetsClient = Pick<DataLayerRpcClient, 'removeAssets' | 'removeAsset'>;

/** A removal that left some files in place; `removed` lists the paths that are gone. */
export class PartialRemovalError extends Error {
  constructor(
    readonly removed: string[],
    readonly cause: unknown,
  ) {
    super(`Removed ${removed.length} file(s) before failing`);
  }
}

const isMissingMethod = (error: unknown) =>
  error instanceof Error && /not implemented in server port/.test(error.message);

async function removeOneByOne(dataLayer: RemoveAssetsClient, paths: string[]) {
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

/**
 * Removes `paths` in one undoable batch, or one by one on hosts that predate the batch method.
 * @returns the removed paths
 * @throws PartialRemovalError when some files could not be removed
 */
export async function removeAssetFiles(
  dataLayer: RemoveAssetsClient,
  paths: string[],
): Promise<string[]> {
  if (!paths.length) return [];
  let result: { success: string[]; failed: string[] };
  try {
    result = await dataLayer.removeAssets({ paths });
  } catch (error) {
    if (!isMissingMethod(error)) throw error;
    console.warn('Batch asset removal is not available, removing the files one by one', error);
    return removeOneByOne(dataLayer, paths);
  }
  if (result.failed.length) {
    throw new PartialRemovalError(
      result.success,
      new Error(`Could not remove ${result.failed.join(', ')}`),
    );
  }
  return result.success;
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
