import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { MdOutlineEmojiPeople as EmoteIcon } from 'react-icons/md';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { MdContentCopy as CopyNameIcon } from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { Tree } from '../Tree';
import type { DropType } from '../Tree/utils';
import { Modal } from '../Modal';
import { Button } from '../Button';
import FolderIcon from '../Icons/Folder';
import { CopyPathIcon, NewFolderIcon } from '../Icons/ContextMenu';
import Search from '../Search';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { getSceneClient } from '../../lib/rpc/scene';
import { copyBuiltInEmoteName } from '../../lib/logic/built-in-emotes';
import { getDataLayerInterface, removeAssets } from '../../redux/data-layer';
import { selectThumbnailsLoaded } from '../../redux/app';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useContextMenu } from '../../hooks/sdk/useContextMenu';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  BACKSPACE,
  COPY,
  COPY_ALT,
  CUT,
  CUT_ALT,
  DELETE,
  DUPLICATE,
  DUPLICATE_ALT,
  ESCAPE,
  EXTEND_DOWN,
  EXTEND_UP,
  PASTE,
  PASTE_ALT,
  SELECT_ALL,
  SELECT_ALL_ALT,
  useHotkey,
} from '../../hooks/useHotkey';
import { determineAssetType, extractFileExtension } from '../ImportAsset/utils';
import { getThumbnailHashNameForAsset } from '../../lib/utils/hash';
import {
  getFilterFromTree,
  getFullNodePath,
  isBuiltInPath,
  isEmoteAsset,
  isReadOnlyPath,
} from './utils';
import type { AssetNodeFolder, AssetNodeItem } from './types';
import { Tile } from './Tile';
import {
  generateAssetTree,
  getChildren as _getChildren,
  getEmptiedFolders,
  TreeNode,
  ROOT,
  getTiles,
} from './tree';
import { Filters } from './Filters';
import { Filter } from './Filters/types';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { useAssetOperations } from './useAssetOperations';
import { useAssetExplorerActive } from './useAssetExplorerActive';
import {
  collectAssetReferences,
  createPathMapper,
  getBaseName,
  getParentPath,
  getRange,
  getUniqueCopyName,
  joinPath,
  pruneNestedPaths,
} from './file-ops';

export { TreeNode };

const MAX_QUEUED_THUMBNAILS = 60;

/** Adds the folders that only exist in the explorer (still empty) to a generated tree. */
function withVirtualFolders(tree: Map<string, TreeNode>, virtualFolders: string[]) {
  if (!virtualFolders.length) return tree;
  const next = new Map(tree);
  for (const virtualPath of virtualFolders) {
    let current = '';
    for (const part of virtualPath.split('/')) {
      const path = joinPath(current, part);
      if (!next.has(path)) {
        const parentKey = current || ROOT;
        const parent = next.get(parentKey);
        if (!parent) break;
        next.set(path, {
          type: 'folder',
          name: part,
          parent: current ? (next.get(current) as unknown as AssetNodeFolder) : null,
          children: [],
        });
        next.set(parentKey, { ...parent, children: [...(parent.children ?? []), path] });
      }
      current = path;
    }
  }
  return next;
}

type Props = {
  folders: AssetNodeFolder[];
  thumbnails: { path: string; content: Uint8Array }[];
};

interface ModalState {
  isOpen: boolean;
  values: string[];
  entities: Entity[];
  /** Deleted folders, so the empty ones that only exist in the explorer go away on confirm. */
  folders: string[];
  /** Folders the deletion leaves empty, kept in the explorer on confirm. */
  emptied: string[];
}

export const DRAG_N_DROP_ASSET_KEY = 'local-asset';

const FilesTree = Tree<string>();

function ProjectView({ folders, thumbnails }: Props) {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const thumbnailsLoaded = useAppSelector(selectThumbnailsLoaded);
  const { handleAction } = useContextMenu();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(new Set<string>());
  const [modal, setModal] = useState<ModalState | undefined>(undefined);
  const [lastSelected, setLastSelected] = useState<string>(ROOT);
  const [selection, setSelection] = useState<string[]>([]);
  const [focusItem, setFocusItem] = useState<string>('');
  const [anchor, setAnchor] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [filteredTree, setTree] = useState<Map<string, TreeNode>>(new Map());
  const [filters, setFilters] = useState<Filter[]>([]);
  const [activeFilter, setActiveFilter] = useState(Filter.All);
  const [virtualFolders, setVirtualFolders] = useState<string[]>([]);
  const [processedThumbnails, setProcessedThumbnails] = useState<Set<string>>(new Set());
  const [thumbnailLookup, setThumbnailLookup] = useState<{
    key: string;
    loaded: boolean;
    map: Map<string, Uint8Array>;
  } | null>(null);
  const clipboard = useRef<{ paths: string[]; cut: boolean } | null>(null);
  const pendingDrop = useRef<{ items: string[]; target: string } | null>(null);

  useEffect(() => {
    const { tree, filters } = generateAssetTree(folders, open, search, activeFilter);
    setTree(tree);
    setFilters(getFilterFromTree(filters));
  }, [folders, search, activeFilter]);

  const tree = useMemo(
    () =>
      search || activeFilter !== Filter.All
        ? filteredTree
        : withVirtualFolders(filteredTree, virtualFolders),
    [filteredTree, virtualFolders, search, activeFilter],
  );
  const realTree = useMemo(
    () => generateAssetTree(folders, new Set(), '', Filter.All).tree,
    [folders],
  );
  const fullTree = useMemo(
    () => withVirtualFolders(realTree, virtualFolders),
    [realTree, virtualFolders],
  );
  const operations = useAssetOperations({ tree: fullTree, thumbnails, virtualFolders });
  const isVirtualFolder = useCallback(
    (path: string) => virtualFolders.includes(path) && !realTree.has(path),
    [virtualFolders, realTree],
  );

  const selectionSet = useMemo(() => new Set(selection), [selection]);
  /** What an action on `path` applies to: the whole selection when `path` is part of it. */
  const getTargets = useCallback(
    (path: string) => (selectionSet.has(path) && selection.length > 1 ? selection : [path]),
    [selection, selectionSet],
  );

  /**
   * Selection
   */

  const selectOnly = useCallback((path: string) => {
    setSelection(path ? [path] : []);
    setFocusItem(path);
    setAnchor(path);
  }, []);

  const toggleSelected = useCallback((path: string) => {
    setSelection(current =>
      current.includes(path) ? current.filter($ => $ !== path) : [...current, path],
    );
    setFocusItem(path);
    setAnchor(path);
  }, []);

  const selectRange = useCallback(
    (path: string, ordered: string[]) => {
      setSelection(getRange(ordered, anchor || path, path));
      setFocusItem(path);
    },
    [anchor],
  );

  const clearSelection = useCallback(() => selectOnly(''), [selectOnly]);

  /**
   * Callbacks
   */

  const onSetOpen = useCallback(
    (value: string, isOpen: boolean) => {
      if (isOpen) {
        open.add(value);
      } else {
        open.delete(value);
      }
      setOpen(new Set(open));
    },
    [open, setOpen],
  );

  const getEntitiesWithAsset = useCallback(
    (assetPath: string): Entity[] => {
      if (!sdk || modal?.isOpen) return [];
      const entitiesWithAsset = new Set<Entity>();
      const { components } = sdk;
      const referencing = [
        components.GltfContainer,
        components.Script,
        components.AudioSource,
        components.VideoPlayer,
        components.Material,
        components.Actions,
      ];
      for (const component of referencing) {
        for (const [entity, value] of sdk.engine.getEntitiesWith(component)) {
          if (collectAssetReferences(value).includes(assetPath)) entitiesWithAsset.add(entity);
        }
      }

      return Array.from(entitiesWithAsset);
    },
    [sdk, modal],
  );

  /** Every file on disk at or below `path`, including the ones the explorer does not list. */
  const listFilesOnDisk = useCallback(
    async (path: string): Promise<string[]> => {
      const node = fullTree.get(path);
      if (!node) return [];
      if (node.type === 'asset') return [withAssetDir(path)];
      const dataLayer = getDataLayerInterface();
      if (!realTree.has(path) || !dataLayer) return [];
      const { files } = await dataLayer.getFilesSizes({ path: withAssetDir(path), ignore: [] });
      if (!files.length) throw new Error(`Could not list the files of ${path}`);
      return files.map(file => file.path);
    },
    [fullTree, realTree],
  );

  const removeVirtualFolders = useCallback((folders: string[]) => {
    if (!folders.length) return;
    const isRemoved = (path: string) =>
      folders.some(folder => path === folder || path.startsWith(folder + '/'));
    setVirtualFolders(current => current.filter(path => !isRemoved(path)));
  }, []);

  const keepFolders = useCallback((folders: string[]) => {
    if (!folders.length) return;
    setVirtualFolders(current => Array.from(new Set([...current, ...folders])));
  }, []);

  /** Deletes `values` with every file on disk inside them, confirming first when the scene uses one. */
  const handleRemoveMany = useCallback(
    async (values: string[]) => {
      const candidates = values.filter(value => value !== ROOT);
      const targets = pruneNestedPaths(candidates.filter(value => !isReadOnlyPath(value)));
      if (!targets.length) {
        if (candidates.length) {
          operations.notifyError("The scene folder and the built-in animations can't be deleted");
        }
        return;
      }
      const folders = targets.filter(value => fullTree.get(value)?.type === 'folder');
      const emptied = getEmptiedFolders(fullTree, targets);
      let paths: string[];
      try {
        paths = (await Promise.all(targets.map(listFilesOnDisk))).flat();
      } catch (error) {
        operations.notifyError('Failed to read the files to delete', error);
        return;
      }
      const entities = paths.flatMap(path => getEntitiesWithAsset(path));
      if (entities.length) {
        setModal({ isOpen: true, values: paths, entities, folders, emptied });
        return;
      }
      removeVirtualFolders(folders);
      keepFolders(emptied);
      if (paths.length || folders.length) {
        dispatch(removeAssets({ paths, folders: folders.map(folder => withAssetDir(folder)) }));
      }
      clearSelection();
    },
    [
      fullTree,
      operations,
      listFilesOnDisk,
      getEntitiesWithAsset,
      removeVirtualFolders,
      keepFolders,
      clearSelection,
    ],
  );

  const handleRemove = useCallback(
    (value: string) => void handleRemoveMany(getTargets(value)),
    [handleRemoveMany, getTargets],
  );

  const handleConfirm = useCallback(async () => {
    if (!modal) return;
    removeVirtualFolders(modal.folders);
    keepFolders(modal.emptied);
    dispatch(
      removeAssets({
        paths: modal.values,
        folders: modal.folders.map(folder => withAssetDir(folder)),
      }),
    );
    setModal(undefined);
    clearSelection();
  }, [modal, setModal, removeVirtualFolders, keepFolders, clearSelection]);

  const handleModalClose = useCallback(() => setModal(undefined), []);

  const mentionAsset = useCallback((node: TreeNode, path: string) => {
    const builtInEmote = (node as AssetNodeItem).asset.builtInEmote;
    void getSceneClient()
      ?.mentionAsset(
        builtInEmote ? { builtInEmote: builtInEmote.name } : { path: withAssetDir(path) },
      )
      .catch(console.error);
  }, []);

  const handleDoubleSelect = useCallback(
    (value: string) => {
      const node = tree.get(value);
      if (node?.type === 'asset') mentionAsset(node, value);
    },
    [tree, mentionAsset],
  );

  /** Double click on a card: opens a folder, mentions a file in the AI assistant. */
  const handleOpenFolder = useCallback(
    (node: TreeNode) => () => {
      const path = getFullNodePath(node).slice(1);
      if (node.type === 'asset') return mentionAsset(node, path);
      open.add(path);
      setLastSelected(path);
      selectOnly(path);
    },
    [selectOnly, mentionAsset],
  );
  const handleDragContext = useCallback(() => ({ tree }), [tree]);
  // Drop targets (renderer, video inputs) read a `value` like the Tile emits; the
  // tree's default `{ items }` payload was silently ignored, so dragging from the
  // list did nothing (#1062). `items` stays so the tree's own hover hints keep working.
  const handleDragItem = useCallback(
    (items: string[], context: unknown) => ({ items, value: items[0], context }),
    [],
  );
  const getDragItems = useCallback((path: string) => getTargets(path), [getTargets]);
  const getSelectedItems = useCallback(() => selection, [selection]);
  const isOpen = useCallback((val: string) => open.has(val), [open]);

  const getChildren = useCallback(
    (val: string) => {
      const childs = _getChildren(val, tree, search, activeFilter);
      return childs;
    },
    [tree, search, activeFilter],
  );

  const getVisibleNodes = useCallback(() => {
    const nodes: string[] = [];
    const walk = (id: string) => {
      for (const child of getChildren(id)) {
        nodes.push(child);
        if (open.has(child)) walk(child);
      }
    };
    walk(ROOT);
    return nodes;
  }, [getChildren, open]);

  const onSelect = useCallback(
    (value: string, clickType: 'single' | 'ctrl' | 'shift' = 'single') => {
      if (clickType === 'ctrl') return toggleSelected(value);
      if (clickType === 'shift') return selectRange(value, getVisibleNodes());
      open.add(value);
      setLastSelected(value);
      selectOnly(value);
    },
    [toggleSelected, selectRange, selectOnly, getVisibleNodes, open],
  );

  const getAnimatedThumbnail = useCallback(
    async (value: AssetNodeItem) => {
      const name = await getThumbnailHashNameForAsset(value.asset.src, 'webp');
      return thumbnails.find($ => $.path.endsWith(name))?.content;
    },
    [thumbnails],
  );

  const handleFilterClick = useCallback((type: Filter) => {
    setActiveFilter(type);
  }, []);

  /**
   * File operations (rename, duplicate, move, copy, new folder)
   */

  /** Keeps the selection, the open folders and the empty folders pointing at a renamed path. */
  const followRename = useCallback(
    (oldPath: string, newPath: string) => {
      const map = createPathMapper(oldPath, newPath);
      setSelection(current => current.map(item => map(item) ?? item));
      setFocusItem(current => map(current) ?? current);
      setAnchor(current => map(current) ?? current);
      setLastSelected(current => map(current) ?? current);
      setVirtualFolders(current => current.map(folder => map(folder) ?? folder));
      const next = new Set<string>();
      open.forEach(item => next.add(map(item) ?? item));
      setOpen(next);
    },
    [open],
  );

  const handleRename = useCallback(
    async (path: string, newName: string) => {
      if (isVirtualFolder(path)) {
        const newPath = operations.getNewFolderPath(
          getParentPath(path),
          newName,
          getBaseName(path),
        );
        if (newPath && newPath !== path) followRename(path, newPath);
        return;
      }
      const newPath = await operations.rename(path, newName);
      if (newPath) followRename(path, newPath);
    },
    [operations, followRename, isVirtualFolder],
  );

  /** Copies or moves `paths`; empty folders only exist in the explorer, so they move here. */
  const transfer = useCallback(
    async (paths: string[], options: { targetFolder?: string; move?: boolean }) => {
      if (options.move) keepFolders(getEmptiedFolders(fullTree, paths));
      const created: string[] = [];
      for (const path of paths.filter(isVirtualFolder)) {
        const destination = options.targetFolder ?? getParentPath(path);
        if (destination === path || destination.startsWith(path + '/')) continue;
        const name = getUniqueCopyName(
          getBaseName(path),
          operations.getSiblingNames(destination),
          true,
        );
        const newPath = joinPath(destination, options.move ? getBaseName(path) : name);
        if (options.move) {
          if (operations.getSiblingNames(destination).includes(getBaseName(path))) continue;
          followRename(path, newPath);
        } else {
          setVirtualFolders(current => [...current, newPath]);
        }
        created.push(newPath);
      }
      const real = paths.filter(path => !isVirtualFolder(path));
      created.push(...(await operations.transferMany(real, options)));
      if (created.length) {
        setSelection(created);
        setFocusItem(created[created.length - 1]);
        setAnchor(created[0]);
      }
      return created;
    },
    [operations, isVirtualFolder, followRename, keepFolders, fullTree],
  );

  const handleDuplicate = useCallback(
    (path: string) => void transfer(getTargets(path), {}),
    [transfer, getTargets],
  );

  const handleMove = useCallback(
    async (items: string[], targetFolder: string) => {
      if (!items.length) return;
      await transfer(items, { targetFolder, move: true });
      open.add(targetFolder);
      setOpen(new Set(open));
      setLastSelected(targetFolder);
    },
    [transfer, open],
  );

  const handleTreeDrop = useCallback(
    (source: string, target: string, dropType: DropType) => {
      const node = tree.get(target);
      if (!node) return;
      const folder =
        node.type === 'folder' && dropType === 'inside' ? target : getParentPath(target);
      if (!folder) {
        operations.notifyError('Drop the items on a folder to move them');
        return;
      }
      if (isReadOnlyPath(folder)) {
        operations.notifyError(`Nothing can be moved into "${getBaseName(folder)}"`);
        return;
      }
      if (!pendingDrop.current) {
        pendingDrop.current = { items: [], target: folder };
        setTimeout(() => {
          const drop = pendingDrop.current;
          pendingDrop.current = null;
          if (drop) void handleMove(drop.items, drop.target);
        }, 0);
      }
      pendingDrop.current.items.push(source);
    },
    [tree, operations, handleMove],
  );

  const handleAddChild = useCallback(
    (parentPath: string, name: string) => {
      const newPath = operations.getNewFolderPath(parentPath, name);
      if (!newPath) return;
      setVirtualFolders(current => [...current, newPath]);
      open.add(parentPath);
      open.add(newPath);
      setOpen(new Set(open));
      setLastSelected(newPath);
      selectOnly(newPath);
    },
    [operations, open, selectOnly],
  );

  const getPasteTarget = useCallback(() => {
    const reference = focusItem || lastSelected;
    const node = tree.get(reference);
    if (!node || reference === ROOT) return undefined;
    return node.type === 'folder' ? reference : getParentPath(reference) || undefined;
  }, [focusItem, lastSelected, tree]);

  const handlePaste = useCallback(async () => {
    const copied = clipboard.current;
    if (!copied) return;
    const paths = copied.paths.filter(path => fullTree.has(path));
    if (!paths.length) {
      operations.notifyError('The copied items no longer exist');
      clipboard.current = null;
      return;
    }
    const target = getPasteTarget();
    if (!target) {
      operations.notifyError('Select a folder to paste into');
      return;
    }
    if (copied.cut) {
      clipboard.current = null;
      await handleMove(paths, target);
      return;
    }
    const created = await transfer(paths, { targetFolder: target });
    if (created.length) {
      open.add(target);
      setOpen(new Set(open));
      setLastSelected(target);
    }
  }, [operations, fullTree, getPasteTarget, handleMove, transfer, open]);

  const copyRelativePaths = useCallback(
    (path: string) => operations.copyRelativePath(getTargets(path)),
    [operations, getTargets],
  );
  const copyFileNames = useCallback(
    (path: string) => operations.copyFileName(getTargets(path)),
    [operations, getTargets],
  );

  const getExtraContextMenu = useCallback(
    (val: string) => {
      if (isBuiltInPath(val)) {
        const emote = (tree.get(val) as AssetNodeItem | undefined)?.asset?.builtInEmote;
        if (!emote) return null;
        return (
          <MenuItem
            id="copy-name"
            onClick={handleAction(() => copyBuiltInEmoteName(emote.name))}
          >
            <CopyNameIcon size={16} />
            Copy name
          </MenuItem>
        );
      }
      const isMultiple = getTargets(val).length > 1;
      return (
        <>
          <MenuItem
            id="copy-relative-path"
            onClick={handleAction(() => copyRelativePaths(val))}
          >
            <CopyPathIcon />
            {isMultiple ? 'Copy Paths' : 'Copy Path'}
          </MenuItem>
          <MenuItem
            id="copy-file-name"
            onClick={handleAction(() => copyFileNames(val))}
          >
            <CopyNameIcon size={16} />
            {isMultiple ? 'Copy file names' : 'Copy file name'}
          </MenuItem>
        </>
      );
    },
    [tree, getTargets, copyRelativePaths, copyFileNames, handleAction],
  );

  const isEditableNode = useCallback(
    (val: string) => val !== ROOT && !isReadOnlyPath(val) && tree.has(val),
    [tree],
  );
  const canRenameNode = useCallback(
    (val: string) => isEditableNode(val) && getTargets(val).length === 1,
    [isEditableNode, getTargets],
  );
  const canDuplicateNode = isEditableNode;
  const canDragNode = isEditableNode;
  const canRemoveNode = useCallback(
    (val: string) => getTargets(val).some(isEditableNode),
    [isEditableNode, getTargets],
  );
  const canAddChild = useCallback(
    (val: string) => isEditableNode(val) && tree.get(val)?.type === 'folder',
    [isEditableNode, tree],
  );

  const moveFocus = useCallback(
    (path: string, extend: boolean) => {
      const node = tree.get(path);
      setLastSelected(node?.type === 'asset' ? getParentPath(path) || ROOT : path);
      if (extend) selectRange(path, getVisibleNodes());
      else selectOnly(path);
    },
    [tree, selectRange, selectOnly, getVisibleNodes],
  );

  const tiles = useMemo(
    () => getTiles(lastSelected, tree, search, activeFilter),
    [lastSelected, tree, search, activeFilter],
  );
  const tileIds = useMemo(() => tiles.map(node => getFullNodePath(node).slice(1)), [tiles]);

  const explorerActive = useAssetExplorerActive(containerRef);
  const explorerKeys = { enabled: explorerActive };
  const selectionKeys = { enabled: explorerKeys.enabled && selection.length > 0 };

  const copySelection = (cut: boolean) => {
    const paths = selection.filter(path => fullTree.has(path) && !isReadOnlyPath(path));
    if (paths.length) clipboard.current = { paths, cut };
  };

  const selectAllTiles = () => {
    setSelection(tileIds);
    setAnchor(tileIds[0] ?? '');
    setFocusItem(tileIds[tileIds.length - 1] ?? '');
  };

  const moveVertically = (event: KeyboardEvent) => {
    const down = event.key === 'ArrowDown';
    const visible = getVisibleNodes();
    const index = visible.indexOf(focusItem);
    const next =
      index === -1 ? visible[down ? 0 : visible.length - 1] : visible[index + (down ? 1 : -1)];
    if (next) moveFocus(next, event.shiftKey);
  };

  const moveHorizontally = (event: KeyboardEvent) => {
    const node = focusItem ? tree.get(focusItem) : undefined;
    if (!node) return;
    const isOpenFolder = node.type === 'folder' && open.has(focusItem);
    if (event.key === 'ArrowRight') {
      if (node.type !== 'folder') return;
      if (!isOpenFolder) onSetOpen(focusItem, true);
      else if (node.children?.length) moveFocus(node.children[0], false);
    } else if (isOpenFolder) {
      onSetOpen(focusItem, false);
    } else if (tree.has(getParentPath(focusItem))) {
      moveFocus(getParentPath(focusItem), false);
    }
  };

  useHotkey([COPY, COPY_ALT], () => copySelection(false), document.body, selectionKeys);
  useHotkey([CUT, CUT_ALT], () => copySelection(true), document.body, selectionKeys);
  useHotkey([PASTE, PASTE_ALT], () => void handlePaste(), document.body, explorerKeys);
  useHotkey(
    [DUPLICATE, DUPLICATE_ALT],
    () => void transfer(selection, {}),
    document.body,
    explorerKeys,
  );
  useHotkey([SELECT_ALL, SELECT_ALL_ALT], selectAllTiles, document.body, explorerKeys);
  useHotkey(
    [DELETE, BACKSPACE],
    () => void handleRemoveMany(selection),
    document.body,
    explorerKeys,
  );
  useHotkey([ESCAPE], clearSelection, document.body, explorerKeys);
  useHotkey(
    [ARROW_UP, ARROW_DOWN, EXTEND_UP, EXTEND_DOWN],
    moveVertically,
    document.body,
    explorerKeys,
  );
  useHotkey([ARROW_LEFT, ARROW_RIGHT], moveHorizontally, document.body, explorerKeys);

  useEffect(() => {
    if (!focusItem) return;
    const escaped = focusItem.replace(/["\\]/g, '\\$&');
    containerRef.current
      ?.querySelector(`.Tree-View [data-test-id="${escaped}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [focusItem]);

  const handleTileClick = useCallback(
    (path: string) => (event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) toggleSelected(path);
      else if (event.shiftKey) selectRange(path, tileIds);
      else selectOnly(path);
    },
    [toggleSelected, selectRange, selectOnly, tileIds],
  );

  const modelSources = useMemo(
    () =>
      tiles
        .filter(node => node.type === 'asset' && (node as AssetNodeItem).asset.type === 'gltf')
        .map(node => (node as AssetNodeItem).asset.src),
    [tiles],
  );
  const modelKey = modelSources.join('|');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, Uint8Array>();
      const hashedNames = await Promise.all(
        modelSources.map(src => getThumbnailHashNameForAsset(src)),
      );
      modelSources.forEach((src, index) => {
        const legacyName = getBaseName(src).split('.')[0] + '.png';
        const thumbnail =
          thumbnails.find($ => $.path.endsWith(hashedNames[index])) ??
          thumbnails.find($ => $.path.endsWith(legacyName));
        if (thumbnail) map.set(src, thumbnail.content);
      });
      if (!cancelled) setThumbnailLookup({ key: modelKey, loaded: thumbnailsLoaded, map });
    })();
    return () => {
      cancelled = true;
    };
  }, [modelKey, thumbnails, thumbnailsLoaded]);

  const thumbnailMap =
    thumbnailLookup?.key === modelKey && (thumbnailLookup.loaded || !thumbnailsLoaded)
      ? thumbnailLookup.map
      : undefined;
  const thumbnailQueue = useMemo(
    () =>
      thumbnailsLoaded && thumbnailMap
        ? modelSources
            .filter(src => !thumbnailMap.has(src) && !processedThumbnails.has(src))
            .slice(0, MAX_QUEUED_THUMBNAILS)
        : [],
    [thumbnailsLoaded, thumbnailMap, modelSources, processedThumbnails],
  );
  const handleThumbnailProcessed = useCallback((path: string) => {
    setProcessedThumbnails(current => new Set(current).add(path));
  }, []);

  return (
    <>
      <Modal
        isOpen={!!modal?.isOpen}
        onRequestClose={handleModalClose}
        className="RemoveAsset"
      >
        <h2>
          ⚠️ Removing {modal && modal.values.length > 1 ? 'these assets' : 'this asset'} will break
          some components
        </h2>
        <div>
          <Button
            type="danger"
            size="big"
            onClick={handleConfirm}
          >
            Delete anyway
          </Button>
          <Button
            size="big"
            onClick={handleModalClose}
          >
            Cancel
          </Button>
        </div>
      </Modal>
      <div
        className="ProjectView"
        ref={containerRef}
      >
        <Filters
          filters={filters}
          active={activeFilter}
          onClick={handleFilterClick}
        />
        <div className="Tree-View">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="Search local assets"
            onCancel={() => setSearch('')}
          />
          <FilesTree
            className="editor-assets-tree"
            value={ROOT}
            onAddChild={handleAddChild}
            onDrop={handleTreeDrop}
            onRemove={handleRemove}
            onRename={handleRename}
            onSelect={onSelect}
            onDoubleSelect={handleDoubleSelect}
            onSetOpen={onSetOpen}
            onDuplicate={handleDuplicate}
            getId={(value: string) => value.toString()}
            getChildren={getChildren}
            getLabel={(val: string) => tree.get(val)?.name ?? val}
            getSelectedItems={getSelectedItems}
            isOpen={isOpen}
            isSelected={(val: string) => selectionSet.has(val)}
            isHidden={(val: string) => val === ROOT}
            canRename={canRenameNode}
            canRemove={canRemoveNode}
            canDrag={canDragNode}
            canDuplicate={canDuplicateNode}
            canAddChild={canAddChild}
            addChildLabel="New folder"
            addChildIcon={<NewFolderIcon />}
            getExtraContextMenu={getExtraContextMenu}
            getIcon={val => <NodeIcon value={tree.get(val)} />}
            getDragContext={handleDragContext}
            getDragItem={handleDragItem}
            dndType={DRAG_N_DROP_ASSET_KEY}
          />
        </div>
        <div className="FolderView">
          {tiles.map((node, index) => {
            const valueId = tileIds[index];
            const src = node.type === 'asset' ? (node as AssetNodeItem).asset.src : undefined;
            return (
              <Tile
                key={valueId}
                valueId={valueId}
                value={node}
                getDragContext={handleDragContext}
                getDragItems={getDragItems}
                onDropItems={handleMove}
                onClick={handleTileClick(valueId)}
                onSelect={handleOpenFolder(node)}
                onRemove={handleRemove}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onCopyRelativePath={copyRelativePaths}
                onCopyFileName={copyFileNames}
                selected={selectionSet.has(valueId)}
                readOnly={isReadOnlyPath(valueId)}
                actionCount={getTargets(valueId).length}
                thumbnail={src ? thumbnailMap?.get(src) : undefined}
                thumbnailPending={!!src && thumbnailQueue.includes(src)}
                getAnimatedThumbnail={getAnimatedThumbnail}
                dndType={DRAG_N_DROP_ASSET_KEY}
              />
            );
          })}
        </div>
      </div>
      <ThumbnailGenerator
        queue={thumbnailQueue}
        onProcessed={handleThumbnailProcessed}
      />
    </>
  );
}

function NodeIcon({ value }: { value?: TreeNode }) {
  if (!value) return null;
  if (value.type === 'folder') {
    return (
      <div style={{ marginRight: '4px', marginLeft: '2px', marginTop: '2px' }}>
        <FolderIcon />
      </div>
    );
  } else {
    const Icon = useMemo(() => {
      if (isEmoteAsset((value as AssetNodeItem).asset)) return EmoteIcon;
      const classification = determineAssetType(extractFileExtension(value.name)[1]);
      switch (classification) {
        case 'Models':
          return ModelIcon;
        case 'Images':
          return ImageIcon;
        case 'Audio':
          return AudioIcon;
        case 'Video':
          return VideoIcon;
        case 'Scripts':
          return ScriptIcon;
        case 'Other':
          return OtherIcon;
      }
    }, []);

    return (
      <>
        <svg style={{ width: '4px', height: '4px' }} />
        <Icon style={{ marginRight: '4px' }} />
      </>
    );
  }
}

export default React.memo(ProjectView);
