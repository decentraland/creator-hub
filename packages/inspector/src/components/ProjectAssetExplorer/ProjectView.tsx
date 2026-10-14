import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { MdContentCopy as CopyNameIcon, MdOutlineLink as CopyPathIcon } from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { Tree } from '../Tree';
import type { DropType } from '../Tree/utils';
import { Modal } from '../Modal';
import { Button } from '../Button';
import FolderIcon from '../Icons/Folder';
import Search from '../Search';
import { withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { removeAsset } from '../../redux/data-layer';
import { selectThumbnailsLoaded } from '../../redux/app';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useContextMenu } from '../../hooks/sdk/useContextMenu';
import {
  isAssetExplorerActive,
  setAssetExplorerFocused,
  setPointerOverAssetExplorer,
} from '../../lib/utils/asset-explorer-region';
import { determineAssetType, extractFileExtension } from '../ImportAsset/utils';
import { getThumbnailHashNameForAsset } from '../../lib/utils/hash';
import { getFilterFromTree, getFullNodePath } from './utils';
import type { AssetNodeFolder, AssetNodeItem } from './types';
import { Tile } from './Tile';
import { generateAssetTree, getChildren as _getChildren, TreeNode, ROOT, getTiles } from './tree';
import { Filters } from './Filters';
import { Filter } from './Filters/types';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { useAssetOperations } from './useAssetOperations';
import {
  createPathMapper,
  getBaseName,
  getParentPath,
  getRange,
  getUniqueCopyName,
  joinPath,
} from './file-ops';
import { forwardToViewport, isCameraKey, isViewportFocused } from './viewport-keys';

export { TreeNode };

function noop() {}

const MAX_QUEUED_THUMBNAILS = 60;

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

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
  // Selected cards / tree rows, in the order they were picked
  const [selection, setSelection] = useState<string[]>([]);
  // The row the arrow keys move from, and the fixed end of a Shift range
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
    source: Props['thumbnails'];
    map: Map<string, Uint8Array>;
  } | null>(null);
  const clipboard = useRef<{ paths: string[]; cut: boolean } | null>(null);
  const pendingDrop = useRef<{ items: string[]; target: string } | null>(null);

  useEffect(() => {
    const { tree, filters } = generateAssetTree(folders, open, search, activeFilter);
    setTree(tree);
    setFilters(getFilterFromTree(filters));
  }, [folders, search, activeFilter]);

  // Empty folders created in the explorer are only shown in the unfiltered view
  const tree = useMemo(
    () =>
      search || activeFilter !== Filter.All
        ? filteredTree
        : withVirtualFolders(filteredTree, virtualFolders),
    [filteredTree, virtualFolders, search, activeFilter],
  );
  // The filters and the search hide nodes; the operations must still see all the siblings
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

      const checks = [
        { component: sdk.components.GltfContainer, matcher: (v: any) => v.src === assetPath },
        {
          component: sdk.components.Script,
          matcher: (v: any) => v.value?.some((s: any) => s.path === assetPath),
        },
        {
          component: sdk.components.AudioSource,
          matcher: (v: any) => v.audioClipUrl === assetPath,
        },
        { component: sdk.components.VideoPlayer, matcher: (v: any) => v.src === assetPath },
        {
          component: sdk.components.Material,
          matcher: (v: any) => {
            const material = v.material?.$case === 'pbr' ? v.material.pbr : null;
            return !!(
              material?.texture?.tex?.src === assetPath ||
              material?.alphaTexture?.tex?.src === assetPath ||
              material?.emissiveTexture?.tex?.src === assetPath ||
              material?.bumpTexture?.tex?.src === assetPath
            );
          },
        },
      ];

      checks.forEach(({ component, matcher }) => {
        for (const [entity, value] of sdk.engine.getEntitiesWith(component)) {
          if (matcher(value)) {
            entitiesWithAsset.add(entity);
          }
        }
      });

      return Array.from(entitiesWithAsset);
    },
    [sdk, modal],
  );

  /** Deletes the files among `values` (folders are skipped), asking first if the scene uses them. */
  const handleRemoveMany = useCallback(
    (values: string[]) => {
      const paths = values
        .filter(value => tree.get(value)?.type === 'asset')
        .map(value => withAssetDir(getFullNodePath(tree.get(value)!).slice(1)));
      if (!paths.length) return;
      const entities = paths.flatMap(path => getEntitiesWithAsset(path));
      if (entities.length) {
        return setModal({ isOpen: true, values: paths, entities });
      }
      paths.forEach(path => dispatch(removeAsset({ path })));
      clearSelection();
    },
    [tree, getEntitiesWithAsset, clearSelection],
  );

  const handleRemove = useCallback(
    (value: string) => handleRemoveMany(getTargets(value)),
    [handleRemoveMany, getTargets],
  );

  const handleConfirm = useCallback(async () => {
    if (!modal) return;
    modal.values.forEach(path => dispatch(removeAsset({ path })));
    setModal(undefined);
    clearSelection();
  }, [modal, setModal, clearSelection]);

  const handleModalClose = useCallback(() => setModal(undefined), []);

  const handleOpenFolder = useCallback(
    (node: TreeNode) => () => {
      if (node.type === 'asset') return;
      const path = getFullNodePath(node).slice(1);
      open.add(path);
      setLastSelected(path);
      selectOnly(path);
    },
    [selectOnly],
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
        const newPath = operations.getNewFolderPath(getParentPath(path), newName);
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
    [operations, isVirtualFolder, followRename],
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

  // The tree calls onDrop once per dragged row; gather them so a multi-row drop moves as one batch
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
      const isMultiple = getTargets(val).length > 1;
      return (
        <>
          <MenuItem
            id="copy-relative-path"
            onClick={handleAction(() => copyRelativePaths(val))}
          >
            <CopyPathIcon />
            {isMultiple ? 'Copy relative paths' : 'Copy relative path'}
          </MenuItem>
          <MenuItem
            id="copy-file-name"
            onClick={handleAction(() => copyFileNames(val))}
          >
            <CopyNameIcon />
            {isMultiple ? 'Copy file names' : 'Copy file name'}
          </MenuItem>
        </>
      );
    },
    [getTargets, copyRelativePaths, copyFileNames, handleAction],
  );

  const canRenameNode = useCallback(
    (val: string) => val !== ROOT && !!tree.get(val) && getTargets(val).length === 1,
    [tree, getTargets],
  );
  const canDuplicateNode = useCallback((val: string) => val !== ROOT && !!tree.get(val), [tree]);
  const isAssetNodeValue = useCallback((val: string) => tree.get(val)?.type === 'asset', [tree]);
  const canRemoveNode = useCallback(
    (val: string) => getTargets(val).some(target => tree.get(target)?.type === 'asset'),
    [tree, getTargets],
  );
  const canAddChild = useCallback(
    (val: string) => val !== ROOT && tree.get(val)?.type === 'folder',
    [tree],
  );

  /**
   * Keyboard. The explorer owns the keyboard while the pointer is over it or its last click
   * landed in it; that is how the scene shortcuts sharing the same keys (Delete, Ctrl+C,
   * Ctrl+V) know to step aside. Only the arrows move along the tree: the camera keys are handed
   * to the viewport, which lost the focus when the explorer was clicked.
   */

  const moveFocus = useCallback(
    (path: string, extend: boolean) => {
      const node = tree.get(path);
      // keep the folder's cards on screen while moving through its files
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

  /** Returns true when the explorer handled the key. */
  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!containerRef.current || modal?.isOpen) return false;
    if (isEditableTarget(event.target) || event.altKey) return false;
    const withModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const node = focusItem ? tree.get(focusItem) : undefined;

    if (withModifier && !event.shiftKey) {
      if (key === 'c' || key === 'x') {
        const paths = selection.filter(path => fullTree.has(path));
        if (!paths.length) return false;
        clipboard.current = { paths, cut: key === 'x' };
        return true;
      }
      if (key === 'v') {
        void handlePaste();
        return true;
      }
      if (key === 'd') {
        if (!selection.length) return false;
        void transfer(selection, {});
        return true;
      }
      if (key === 'a') {
        setSelection(tileIds);
        setAnchor(tileIds[0] ?? '');
        setFocusItem(tileIds[tileIds.length - 1] ?? '');
        return true;
      }
      return false;
    }
    if (withModifier) return false;

    if (key === 'delete' || key === 'backspace') {
      if (!selection.some(path => tree.get(path)?.type === 'asset')) return false;
      handleRemoveMany(selection);
      return true;
    }
    if (key === 'escape' && selection.length) {
      clearSelection();
      return true;
    }

    const visible = getVisibleNodes();
    const index = visible.indexOf(focusItem);
    if (key === 'arrowdown' || key === 'arrowup') {
      const next =
        index === -1
          ? key === 'arrowdown'
            ? visible[0]
            : visible[visible.length - 1]
          : visible[index + (key === 'arrowdown' ? 1 : -1)];
      if (next) moveFocus(next, event.shiftKey);
      return true;
    }
    // Left/Right are always consumed so that no arrow moves the camera while the explorer is active
    if (key === 'arrowright') {
      if (node?.type === 'folder' && !event.shiftKey) {
        if (!open.has(focusItem)) onSetOpen(focusItem, true);
        else if (node.children?.length) moveFocus(node.children[0], false);
      }
      return true;
    }
    if (key === 'arrowleft') {
      if (focusItem && !event.shiftKey) {
        if (node?.type === 'folder' && open.has(focusItem)) onSetOpen(focusItem, false);
        else if (tree.has(getParentPath(focusItem))) moveFocus(getParentPath(focusItem), false);
      }
      return true;
    }
    return false;
  };
  const keyDownRef = useRef(handleKeyDown);
  keyDownRef.current = handleKeyDown;

  useEffect(() => {
    const forwardedKeys = new Set<number>();
    const releaseForwardedKeys = () => {
      forwardedKeys.forEach(keyCode => forwardToViewport('keyup', keyCode));
      forwardedKeys.clear();
    };

    // Capture phase: a handled key must not also reach the viewport (arrows move the camera)
    // or the scene hotkeys bound on document.body.
    const onKeyDown = (event: KeyboardEvent) => {
      // the keys forwarded to the viewport travel back through this window: skip them
      if (!event.isTrusted || !isAssetExplorerActive()) return;
      if (keyDownRef.current(event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        isCameraKey(event) &&
        !isEditableTarget(event.target) &&
        !isViewportFocused() &&
        forwardToViewport('keydown', event.keyCode)
      ) {
        forwardedKeys.add(event.keyCode);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.isTrusted || !forwardedKeys.delete(event.keyCode)) return;
      forwardToViewport('keyup', event.keyCode);
    };
    const onPointerDown = (event: PointerEvent) => {
      setAssetExplorerFocused(!!containerRef.current?.contains(event.target as Node));
    };
    const onWindowBlur = () => {
      setAssetExplorerFocused(false);
      releaseForwardedKeys();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
      releaseForwardedKeys();
      setPointerOverAssetExplorer(false);
      setAssetExplorerFocused(false);
    };
  }, []);

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

  /**
   * Thumbnails: images are rendered by the tiles themselves; for 3D models we use the saved
   * thumbnail, and queue a background generation for the ones that don't have it yet.
   */

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
      for (const src of modelSources) {
        // First try to find thumbnail using hash-based lookup
        const hashedThumbnailName = await getThumbnailHashNameForAsset(src);
        let thumbnail = thumbnails.find($ => $.path.endsWith(hashedThumbnailName));
        if (!thumbnail) {
          // Fallback to legacy name-based lookup for backwards compatibility
          const [name] = getBaseName(src).split('.');
          thumbnail = thumbnails.find($ => $.path.endsWith(name + '.png'));
        }
        if (thumbnail) map.set(src, thumbnail.content);
      }
      if (!cancelled) setThumbnailLookup({ key: modelKey, source: thumbnails, map });
    })();
    return () => {
      cancelled = true;
    };
  }, [modelKey, thumbnails]);

  const thumbnailMap =
    thumbnailLookup && thumbnailLookup.key === modelKey && thumbnailLookup.source === thumbnails
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

  const pointerEnter = useCallback(() => setPointerOverAssetExplorer(true), []);
  const pointerLeave = useCallback(() => setPointerOverAssetExplorer(false), []);

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
        onMouseEnter={pointerEnter}
        onMouseLeave={pointerLeave}
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
            onDoubleSelect={noop}
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
            renameOnDoubleClick={isAssetNodeValue}
            canRemove={canRemoveNode}
            canDuplicate={canDuplicateNode}
            canAddChild={canAddChild}
            addChildLabel="New folder"
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
                actionCount={getTargets(valueId).length}
                thumbnail={src ? thumbnailMap?.get(src) : undefined}
                thumbnailPending={!!src && thumbnailQueue.includes(src)}
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
