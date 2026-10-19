import type { DataLayerRpcClient } from './types';

type RemoveAssetsClient = Pick<DataLayerRpcClient, 'removeAssets' | 'removeAsset'>;

/**
 * Removes `paths` as one batch: a single undo entry, and the folders left empty are pruned.
 * The data layer served by `sdk-commands` runs the published inspector, which may predate the
 * batch method, so a failure falls back to the one-file-at-a-time removal every host has.
 */
export async function removeAssetFiles(dataLayer: RemoveAssetsClient, paths: string[]) {
  if (!paths.length) return;
  try {
    await dataLayer.removeAssets({ paths });
  } catch (error) {
    console.warn('Batch asset removal is not available, removing the files one by one', error);
    for (const path of paths) {
      await dataLayer.removeAsset({ path });
    }
  }
}
