import type { DataLayerRpcClient } from './types';

type RemoveAssetsClient = Pick<DataLayerRpcClient, 'removeAssets' | 'removeAsset'>;

/** The paths a removal deleted, its error when it fell short, and whether it ran as one batch. */
export type RemovalResult = { removed: string[]; error?: unknown; batched: boolean };

const PAST_LEGACY_UNDO_WINDOW_MS = 150;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isMissingMethod = (error: unknown) =>
  error instanceof Error && /not implemented in server port/.test(error.message);

async function removeOneByOne(
  dataLayer: RemoveAssetsClient,
  paths: string[],
): Promise<RemovalResult> {
  const removed: string[] = [];
  for (const path of paths) {
    await wait(PAST_LEGACY_UNDO_WINDOW_MS);
    try {
      await dataLayer.removeAsset({ path });
    } catch (error) {
      return { removed, error, batched: false };
    }
    removed.push(path);
  }
  return { removed, batched: false };
}

/** Removes `paths` in one undoable batch, or one by one on hosts that predate the batch method. */
export async function removeAssetFiles(
  dataLayer: RemoveAssetsClient,
  paths: string[],
): Promise<RemovalResult> {
  if (!paths.length) return { removed: [], batched: true };
  let result: { success: string[]; failed: string[] };
  try {
    result = await dataLayer.removeAssets({ paths });
  } catch (error) {
    if (!isMissingMethod(error)) return { removed: [], error, batched: true };
    console.warn('Batch asset removal is not available, removing the files one by one', error);
    return removeOneByOne(dataLayer, paths);
  }
  if (!result.failed.length) return { removed: result.success, batched: true };
  const error = new Error(`Could not remove ${result.failed.join(', ')}`);
  return { removed: result.success, error, batched: true };
}

const batchRemovalSupport = new WeakMap<RemoveAssetsClient, Promise<boolean>>();

function supportsBatchRemoval(dataLayer: RemoveAssetsClient): Promise<boolean> {
  let support = batchRemovalSupport.get(dataLayer);
  if (!support) {
    support = dataLayer.removeAssets({ paths: [] }).then(
      () => true,
      error => !isMissingMethod(error),
    );
    batchRemovalSupport.set(dataLayer, support);
  }
  return support;
}

/** On hosts without batch removal, waits until their pending file undo entry is committed. */
export async function waitForLegacyUndoCommit(dataLayer: RemoveAssetsClient): Promise<void> {
  if (!(await supportsBatchRemoval(dataLayer))) await wait(PAST_LEGACY_UNDO_WINDOW_MS);
}
