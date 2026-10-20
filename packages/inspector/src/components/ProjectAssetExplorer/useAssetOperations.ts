import { useCallback } from 'react';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useAppDispatch } from '../../redux/hooks';
import { getAssetCatalog, getDataLayerInterface, saveThumbnail } from '../../redux/data-layer';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { removeAssetFiles } from '../../lib/data-layer/remove-assets';
import { copyToClipboard } from '../../lib/utils/clipboard';
import { getGltfResourceUris } from '../../lib/utils/gltf';
import { getThumbnailHashNameForAsset } from '../../lib/utils/hash';
import type { TreeNode } from './tree';
import { ROOT } from './tree';
import { isReadOnlyPath } from './utils';
import {
  createPathMapper,
  getBaseName,
  getParentPath,
  getUniqueCopyName,
  isOutsideAssets,
  joinPath,
  normalizePath,
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

/** A transfer refused for a reason the user can act on; its message is shown as is. */
class TransferError extends Error {}

const READ_ONLY_HINT = 'the scene folder and the built-in animations are read only';

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

  /** The file at `path` (relative to `assets/`), or undefined when there is none. */
  const readIfExists = useCallback(async (path: string): Promise<Uint8Array | undefined> => {
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) throw new Error('Data layer is not available');
    const { files } = await dataLayer.getFilesList({ paths: [withAssetDir(path)] });
    const file = files[0];
    return file?.success ? file.content : undefined;
  }, []);

  /** Adds copies of the files transferred models load by relative URI, where they will look. */
  const addGltfResources = useCallback(
    async (files: { from: string; to: string }[], content: Map<string, Uint8Array>) => {
      for (const { from, to } of files) {
        if (!/\.(gltf|glb)$/i.test(to)) continue;
        for (const uri of getGltfResourceUris(content.get(to)!)) {
          const target = normalizePath(joinPath(getParentPath(to), uri));
          const source = normalizePath(joinPath(getParentPath(from), uri));
          if (content.has(target)) continue;
          if (isOutsideAssets(target) || isOutsideAssets(source)) {
            throw new TransferError(
              `"${getBaseName(to)}" references "${uri}", which is outside the assets folder`,
            );
          }
          if (await readIfExists(target)) continue;
          const resource = await readIfExists(source);
          if (resource) content.set(target, resource);
        }
      }
    },
    [readIfExists],
  );

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
        components.Actions,
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

  /** Copies `fromPath` to `toPath`, or moves it with `removeSource`; returns the sources left behind. */
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
        const to = joinPath(getParentPath(toPath), toName + relative.slice(fromName.length));
        content.set(to, bytes);
        files.push({ from: joinPath(getParentPath(fromPath), relative), to });
      }
      await addGltfResources(files, content);

      await dataLayer.importAsset({ content, basePath: withAssetDir(), assetPackageName: '' });

      for (const { from, to } of files) void copyThumbnail(from, to);

      let leftBehind: string[] = [];
      if (removeSource) {
        const sources = files.map(({ from }) => withAssetDir(from));
        leftBehind = await removeAssetFiles(dataLayer, sources).then(
          () => [],
          error => {
            console.error(`Failed to remove the sources of ${fromPath}`, error);
            return [fromPath];
          },
        );
        await updateSceneReferences(createPathMapper(withAssetDir(fromPath), withAssetDir(toPath)));
      }

      if (refreshCatalog) dispatch(getAssetCatalog());
      return leftBehind;
    },
    [readEntries, addGltfResources, copyThumbnail, updateSceneReferences, dispatch],
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
      if (isReadOnlyPath(path)) {
        notifyError(`"${getBaseName(path)}" can't be renamed: ${READ_ONLY_HINT}`);
        return undefined;
      }
      const isFolder = node.type !== 'asset';
      const trimmed = newName.trim();
      const error = validateName(trimmed, getSiblingNames(getParentPath(path)), getBaseName(path));
      if (error) {
        notifyError(error);
        return undefined;
      }
      if (trimmed === getBaseName(path)) return undefined;
      if (trimmed.toLowerCase() === getBaseName(path).toLowerCase()) {
        notifyError('Changing only the letter case is not supported; pick a different name');
        return undefined;
      }
      const newPath = joinPath(getParentPath(path), trimmed);
      try {
        const leftBehind = await transfer(path, newPath, isFolder, true);
        if (leftBehind.length) notifyError(`Renamed, but could not remove ${getBaseName(path)}`);
      } catch (e) {
        if (e instanceof TransferError) notifyError(e.message);
        else notifyError(`Failed to rename ${getBaseName(path)}`, e);
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
      const verb = move ? 'move' : 'copy';
      if (targetFolder !== undefined && isReadOnlyPath(targetFolder)) {
        notifyError(
          `Nothing can be ${move ? 'moved' : 'copied'} into "${getBaseName(targetFolder)}": ${READ_ONLY_HINT}`,
        );
        return [];
      }
      const created: string[] = [];
      const takenByFolder = new Map<string, string[]>();
      const failed: string[] = [];
      const leftBehind: string[] = [];
      const readOnly: string[] = [];
      for (const path of pruneNestedPaths(paths)) {
        const node = tree.get(path);
        if (!node) continue;
        const name = getBaseName(path);
        if (isReadOnlyPath(path)) {
          readOnly.push(name);
          continue;
        }
        const isFolder = node.type !== 'asset';
        const destination = targetFolder ?? getParentPath(path);
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
          leftBehind.push(...(await transfer(path, newPath, isFolder, move, false)));
          takenByFolder.set(destination, [...taken, newName]);
          created.push(newPath);
        } catch (e) {
          if (e instanceof TransferError) notifyError(e.message);
          else {
            console.error(`Failed to ${verb} ${path}`, e);
            failed.push(name);
          }
        }
      }
      if (readOnly.length) {
        notifyError(
          `${readOnly.join(', ')} can't be ${move ? 'moved' : 'copied'}: ${READ_ONLY_HINT}`,
        );
      }
      if (failed.length) {
        notifyError(`Failed to ${verb} ${failed.join(', ')}`);
      }
      if (leftBehind.length) {
        notifyError(`Moved, but could not remove ${leftBehind.map(getBaseName).join(', ')}`);
      }
      if (created.length) dispatch(getAssetCatalog());
      return created;
    },
    [tree, getSiblingNames, transfer, notifyError, dispatch],
  );

  const copyLines = useCallback(
    (lines: string[]) =>
      copyToClipboard(lines.join('\n')).catch(error =>
        notifyError('Could not copy to the clipboard', error),
      ),
    [notifyError],
  );

  const copyRelativePath = useCallback(
    (paths: string[]) => copyLines(paths.map(path => withAssetDir(path))),
    [copyLines],
  );

  const copyFileName = useCallback(
    (paths: string[]) => copyLines(paths.map(getBaseName)),
    [copyLines],
  );

  /** Validates a folder name in `parentPath` (`current` when renaming); returns the path when free. */
  const getNewFolderPath = useCallback(
    (parentPath: string, name: string, current?: string): string | undefined => {
      const trimmed = name.trim();
      const error = validateName(trimmed, getSiblingNames(parentPath), current);
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
