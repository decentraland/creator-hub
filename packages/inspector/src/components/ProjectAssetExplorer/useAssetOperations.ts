import { useCallback } from 'react';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useAppDispatch } from '../../redux/hooks';
import { getAssetCatalog, getDataLayerInterface, saveThumbnail } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { getThumbnailHashNameForAsset } from '../../lib/utils/hash';
import type { TreeNode } from './tree';
import { ROOT } from './tree';
import {
  copyTextToClipboard,
  createPathMapper,
  getBaseName,
  getParentPath,
  getUniqueCopyName,
  joinPath,
  pruneNestedPaths,
  replaceAssetReferences,
  validateName,
} from './file-ops';

type Thumbnails = { path: string; content: Uint8Array }[];

type Options = {
  /** Unfiltered tree: the filters and the search only hide nodes, they must not hide siblings. */
  tree: Map<string, TreeNode>;
  thumbnails: Thumbnails;
  /** Empty folders that only exist in the explorer until something is put inside. */
  virtualFolders: string[];
};

/** File and folder operations of the Local Assets tab. Paths are relative to `assets/`. */
export function useAssetOperations({ tree, thumbnails, virtualFolders }: Options) {
  const dispatch = useAppDispatch();
  const sdk = useSdk();
  const { pushNotification } = useSnackbar();

  const getSiblingNames = useCallback(
    (parentPath: string): string[] => {
      const parent = tree.get(parentPath || ROOT);
      const names = (parent?.children ?? []).map(getBaseName);
      for (const virtual of virtualFolders) {
        if (getParentPath(virtual) === parentPath) names.push(getBaseName(virtual));
      }
      return names;
    },
    [tree, virtualFolders],
  );

  /** Every file below `path` (or the file itself), keyed by its path relative to `path`'s parent. */
  const readEntries = useCallback(async (path: string, isFolder: boolean) => {
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) throw new Error('Data layer is not available');
    const entries = new Map<string, Uint8Array>();
    const parentLength = getParentPath(path) ? getParentPath(path).length + 1 : 0;
    if (isFolder) {
      const { files } = await dataLayer.getFiles({ path: withAssetDir(path), ignore: [] });
      const prefix = withAssetDir().length + 1;
      for (const file of files) entries.set(file.path.slice(prefix + parentLength), file.content);
    } else {
      const { content } = await dataLayer.getFile({ path: withAssetDir(path) });
      entries.set(path.slice(parentLength), content);
    }
    return entries;
  }, []);

  const copyThumbnail = useCallback(
    async (fromSrc: string, toSrc: string) => {
      const fromHash = await getThumbnailHashNameForAsset(fromSrc);
      const thumbnail = thumbnails.find($ => $.path.endsWith(fromHash));
      if (thumbnail) dispatch(saveThumbnail({ content: thumbnail.content, path: toSrc }));
    },
    [thumbnails, dispatch],
  );

  const updateSceneReferences = useCallback(
    async (map: (path: string) => string | undefined) => {
      if (!sdk) return;
      const { components, engine } = sdk;
      const referencing = [
        components.GltfContainer,
        components.AudioSource,
        components.VideoPlayer,
        components.Material,
        components.Script,
      ];
      let changed = false;
      for (const component of referencing) {
        for (const [entity, value] of engine.getEntitiesWith(component)) {
          const next = replaceAssetReferences(value, map);
          if (next !== value) {
            (component as any).createOrReplace(entity, next);
            changed = true;
          }
        }
      }
      if (changed) await sdk.operations.dispatch();
    },
    [sdk],
  );

  /**
   * Copies `fromPath` (file or folder) to `toPath`. When `removeSource` is set it is a move/rename:
   * the references in the scene are rewritten and the original files are removed afterwards.
   */
  const transfer = useCallback(
    async (
      fromPath: string,
      toPath: string,
      isFolder: boolean,
      removeSource: boolean,
      refreshCatalog = true,
    ) => {
      const dataLayer = getDataLayerInterface();
      if (!dataLayer) throw new Error('Data layer is not available');

      const sourceEntries = await readEntries(fromPath, isFolder);
      const content = new Map<string, Uint8Array>();
      const fromName = getBaseName(fromPath);
      const toName = getBaseName(toPath);
      const files: { from: string; to: string }[] = [];
      for (const [relative, bytes] of sourceEntries) {
        const target = toName + relative.slice(fromName.length);
        content.set(target, bytes);
        files.push({
          from: joinPath(getParentPath(fromPath), relative),
          to: joinPath(getParentPath(toPath), target),
        });
      }

      await dataLayer.importAsset({
        content,
        basePath: withAssetDir(getParentPath(toPath)),
        assetPackageName: '',
      });

      for (const { from, to } of files) void copyThumbnail(from, to);

      if (removeSource) {
        const map = createPathMapper(withAssetDir(fromPath), withAssetDir(toPath));
        await updateSceneReferences(map);
        // one by one so that every removal is recorded in the undo history
        for (const { from } of files) {
          await dataLayer.removeAsset({ path: withAssetDir(from) });
        }
      }

      if (refreshCatalog) dispatch(getAssetCatalog());
    },
    [readEntries, copyThumbnail, updateSceneReferences, dispatch],
  );

  const notifyError = useCallback(
    (message: string, error?: unknown) => {
      if (error) console.error(message, error);
      void pushNotification('error', message);
    },
    [pushNotification],
  );

  /** Renames `path` to `newName` in the same folder. Returns the new path when it worked. */
  const rename = useCallback(
    async (path: string, newName: string): Promise<string | undefined> => {
      const node = tree.get(path);
      if (!node) return undefined;
      const isFolder = node.type !== 'asset';
      const trimmed = newName.trim();
      const error = validateName(trimmed, getSiblingNames(getParentPath(path)), getBaseName(path));
      if (error) {
        notifyError(error);
        return undefined;
      }
      if (trimmed === getBaseName(path)) return undefined;
      const newPath = joinPath(getParentPath(path), trimmed);
      try {
        await transfer(path, newPath, isFolder, true);
      } catch (e) {
        notifyError(`Failed to rename ${getBaseName(path)}`, e);
        return undefined;
      }
      return newPath;
    },
    [tree, getSiblingNames, transfer, notifyError],
  );

  /**
   * Copies (or moves, with `move`) every path into `targetFolder`, or into each path's own folder
   * when it is omitted. Names already taken in the destination get a "copy" suffix, including the
   * ones taken earlier in the same batch. Returns the new paths of the items that made it.
   */
  const transferMany = useCallback(
    async (
      paths: string[],
      { targetFolder, move = false }: { targetFolder?: string; move?: boolean } = {},
    ): Promise<string[]> => {
      const created: string[] = [];
      const takenByFolder = new Map<string, string[]>();
      const failed: string[] = [];
      for (const path of pruneNestedPaths(paths)) {
        const node = tree.get(path);
        if (!node) continue;
        const isFolder = node.type !== 'asset';
        const destination = targetFolder ?? getParentPath(path);
        const name = getBaseName(path);
        if (isFolder && (destination === path || destination.startsWith(path + '/'))) {
          notifyError(`"${name}" cannot be placed inside itself`);
          continue;
        }
        if (move && destination === getParentPath(path)) continue;
        const taken = takenByFolder.get(destination) ?? getSiblingNames(destination);
        const newName = taken.some($ => $.toLowerCase() === name.toLowerCase())
          ? getUniqueCopyName(name, taken, isFolder)
          : name;
        const newPath = joinPath(destination, newName);
        try {
          await transfer(path, newPath, isFolder, move, false);
          takenByFolder.set(destination, [...taken, newName]);
          created.push(newPath);
        } catch (e) {
          console.error(`Failed to ${move ? 'move' : 'copy'} ${path}`, e);
          failed.push(name);
        }
      }
      if (failed.length) {
        notifyError(`Failed to ${move ? 'move' : 'copy'} ${failed.join(', ')}`);
      }
      if (created.length) dispatch(getAssetCatalog());
      return created;
    },
    [tree, getSiblingNames, transfer, notifyError, dispatch],
  );

  const copyRelativePath = useCallback(
    async (paths: string[]) => {
      const ok = await copyTextToClipboard(paths.map(path => withAssetDir(path)).join('\n'));
      if (!ok) notifyError('Could not copy the path to the clipboard');
    },
    [notifyError],
  );

  const copyFileName = useCallback(
    async (paths: string[]) => {
      const ok = await copyTextToClipboard(paths.map(getBaseName).join('\n'));
      if (!ok) notifyError('Could not copy the name to the clipboard');
    },
    [notifyError],
  );

  /** Validates the name of a new folder, returning the new path when it is free to use. */
  const getNewFolderPath = useCallback(
    (parentPath: string, name: string): string | undefined => {
      const trimmed = name.trim();
      const error = validateName(trimmed, getSiblingNames(parentPath));
      if (error) {
        notifyError(error);
        return undefined;
      }
      return joinPath(parentPath, trimmed);
    },
    [getSiblingNames, notifyError],
  );

  return {
    rename,
    transferMany,
    copyRelativePath,
    copyFileName,
    getNewFolderPath,
    getSiblingNames,
    notifyError,
  };
}
