import type { Storage } from '../logic/storage/types';
import { DIRECTORY, getParentPath } from './host/fs-utils';
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

type FolderStorage = Pick<Storage, 'list' | 'rmdir'>;

async function listFoldersDeepestFirst(storage: FolderStorage, path: string): Promise<string[]> {
  const entries = await storage.list(path).catch(() => []);
  const below = await Promise.all(
    entries
      .filter(entry => entry.isDirectory)
      .map(entry => listFoldersDeepestFirst(storage, `${path}/${entry.name}`)),
  );
  return [...below.flat(), path];
}

async function removeIfEmpty(storage: FolderStorage, path: string): Promise<boolean> {
  const entries = await storage.list(path).catch(() => undefined);
  if (!entries || entries.length) return false;
  return storage.rmdir(path).then(
    () => true,
    () => false,
  );
}

/** Removes the folders that removing `files` left empty, up to but not including `assets`. */
export async function removeEmptiedFolders(storage: FolderStorage, files: string[]): Promise<void> {
  for (const start of new Set(files.map(getParentPath))) {
    let folder = start;
    while (folder.startsWith(`${DIRECTORY.ASSETS}/`) && (await removeIfEmpty(storage, folder))) {
      folder = getParentPath(folder);
    }
  }
}

/** Removes each of `folders` and the folders below them, keeping any that still hold a file. */
export async function removeEmptyFolders(storage: FolderStorage, folders: string[]): Promise<void> {
  for (const folder of folders) {
    for (const path of await listFoldersDeepestFirst(storage, folder)) {
      await removeIfEmpty(storage, path);
    }
  }
}
