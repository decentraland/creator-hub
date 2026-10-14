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
  isPointerOverAssetExplorer,
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
  getUniqueCopyName,
  joinPath,
} from './file-ops';

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
  value: string;
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
  // The card / tree row the keyboard shortcuts act on
  const [selectedItem, setSelectedItem] = useState<string>('');
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
  const clipboard = useRef<string | null>(null);

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

  /**
   * Callbacks
   */

  const onSelect = useCallback(
    (value: string) => {
      open.add(value);
      setLastSelected(value);
      setSelectedItem(value);
    },
    [setLastSelected],
  );

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

  const handleRemove = useCallback(
    async (value: string) => {
      const path = withAssetDir(getFullNodePath(tree.get(value)!).slice(1));
      const entitiesWithAsset = getEntitiesWithAsset(path);
      if (entitiesWithAsset.length) {
        return setModal({ isOpen: true, value: path, entities: entitiesWithAsset });
      }
      dispatch(removeAsset({ path }));
    },
    [tree, getEntitiesWithAsset],
  );

  const handleConfirm = useCallback(async () => {
    if (!modal) return;
    dispatch(removeAsset({ path: modal.value }));
    setModal(undefined);
  }, [modal, setModal]);

  const handleModalClose = useCallback(() => setModal(undefined), []);

  const handleClickFolder = useCallback(
    (node: TreeNode) => () => {
      if (node.type === 'asset') return;
      const path = getFullNodePath(node).slice(1);
      open.add(path);
      setLastSelected(path);
      setSelectedItem(path);
    },
    [setLastSelected],
  );
  const handleDragContext = useCallback(() => ({ tree }), [tree]);
  // Drop targets (renderer, video inputs) read a `value` like the Tile emits; the
  // tree's default `{ items }` payload was silently ignored, so dragging from the
  // list did nothing (#1062). `items` stays so the tree's own hover hints keep working.
  const handleDragItem = useCallback(
    (items: string[], context: unknown) => ({ items, value: items[0], context }),
    [],
  );
  const isOpen = useCallback((val: string) => open.has(val), [open]);

  const getChildren = useCallback(
    (val: string) => {
      const childs = _getChildren(val, tree, search, activeFilter);
      return childs;
    },
    [tree, search, activeFilter],
  );

  const handleFilterClick = useCallback((type: Filter) => {
    setActiveFilter(type);
  }, []);

  /**
   * File operations (rename, duplicate, copy, new folder)
   */

  /** Keeps the selection, the open folders and the empty folders pointing at a renamed path. */
  const followRename = useCallback(
    (oldPath: string, newPath: string) => {
      const map = createPathMapper(oldPath, newPath);
      setSelectedItem(current => map(current) ?? current);
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

  const handleDuplicate = useCallback(
    async (path: string) => {
      if (isVirtualFolder(path)) {
        const parent = getParentPath(path);
        const name = getUniqueCopyName(getBaseName(path), operations.getSiblingNames(parent), true);
        const newPath = joinPath(parent, name);
        setVirtualFolders(current => [...current, newPath]);
        setSelectedItem(newPath);
        return;
      }
      const newPath = await operations.duplicate(path);
      if (newPath) setSelectedItem(newPath);
    },
    [operations, isVirtualFolder],
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
      setSelectedItem(newPath);
    },
    [operations, open],
  );

  const handlePaste = useCallback(async () => {
    const source = clipboard.current;
    if (!source) return;
    if (!fullTree.has(source)) {
      operations.notifyError('The copied item no longer exists');
      clipboard.current = null;
      return;
    }
    const reference = selectedItem || lastSelected;
    const node = tree.get(reference);
    const target =
      !node || reference === ROOT
        ? undefined
        : node.type === 'folder'
          ? reference
          : getParentPath(reference);
    if (!target) {
      operations.notifyError('Select a folder to paste into');
      return;
    }
    const newPath = await operations.duplicate(source, target);
    if (newPath) {
      open.add(target);
      setOpen(new Set(open));
      setLastSelected(target);
      setSelectedItem(newPath);
    }
  }, [operations, fullTree, tree, selectedItem, lastSelected, open]);

  const getExtraContextMenu = useCallback(
    (val: string) => (
      <>
        <MenuItem
          id="copy-relative-path"
          onClick={handleAction(() => operations.copyRelativePath(val))}
        >
          <CopyPathIcon /> Copy relative path
        </MenuItem>
        <MenuItem
          id="copy-file-name"
          onClick={handleAction(() => operations.copyFileName(val))}
        >
          <CopyNameIcon /> Copy file name
        </MenuItem>
      </>
    ),
    [operations, handleAction],
  );

  const canRenameNode = useCallback((val: string) => val !== ROOT && !!tree.get(val), [tree]);
  const isAssetNodeValue = useCallback((val: string) => tree.get(val)?.type === 'asset', [tree]);
  const canAddChild = useCallback(
    (val: string) => val !== ROOT && tree.get(val)?.type === 'folder',
    [tree],
  );

  /**
   * Keyboard shortcuts. They only act while the pointer is over the explorer, which is how the
   * scene shortcuts that share the same keys (Delete, Ctrl+C, Ctrl+V) know to step aside.
   */

  const selectNode = useCallback(
    (path: string) => {
      setSelectedItem(path);
      const node = tree.get(path);
      // keep the folder's cards on screen while moving through its files
      setLastSelected(node?.type === 'asset' ? getParentPath(path) || ROOT : path);
    },
    [tree],
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

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!containerRef.current || modal?.isOpen || event.defaultPrevented) return;
    if (isEditableTarget(event.target) || event.altKey) return;
    const withModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const node = selectedItem ? tree.get(selectedItem) : undefined;

    if (withModifier && !event.shiftKey && (key === 'c' || key === 'v')) {
      if (key === 'c') {
        if (!selectedItem || !fullTree.has(selectedItem)) return;
        clipboard.current = selectedItem;
      } else {
        void handlePaste();
      }
      return event.preventDefault();
    }
    if (withModifier || event.shiftKey) return;

    if (key === 'delete' || key === 'backspace') {
      if (node?.type !== 'asset') return;
      event.preventDefault();
      void handleRemove(selectedItem);
      setSelectedItem('');
      return;
    }

    const visible = getVisibleNodes();
    const index = visible.indexOf(selectedItem);
    if (key === 'arrowdown' || key === 'arrowup') {
      event.preventDefault();
      const next =
        index === -1
          ? key === 'arrowdown'
            ? visible[0]
            : visible[visible.length - 1]
          : visible[index + (key === 'arrowdown' ? 1 : -1)];
      if (next) selectNode(next);
    } else if (key === 'arrowright' && node?.type === 'folder') {
      event.preventDefault();
      if (!open.has(selectedItem)) onSetOpen(selectedItem, true);
      else if (node.children?.length) selectNode(node.children[0]);
    } else if (key === 'arrowleft' && selectedItem) {
      event.preventDefault();
      if (node?.type === 'folder' && open.has(selectedItem)) onSetOpen(selectedItem, false);
      else if (tree.has(getParentPath(selectedItem))) selectNode(getParentPath(selectedItem));
    }
  };
  const keyDownRef = useRef(handleKeyDown);
  keyDownRef.current = handleKeyDown;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (isPointerOverAssetExplorer()) keyDownRef.current(event);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      setPointerOverAssetExplorer(false);
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    const escaped = selectedItem.replace(/["\\]/g, '\\$&');
    containerRef.current
      ?.querySelector(`.Tree-View [data-test-id="${escaped}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedItem]);

  /**
   * Thumbnails: images are rendered by the tiles themselves; for 3D models we use the saved
   * thumbnail, and queue a background generation for the ones that don't have it yet.
   */

  const tiles = useMemo(
    () => getTiles(lastSelected, tree, search, activeFilter),
    [lastSelected, tree, search, activeFilter],
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
        <h2>⚠️ Removing this asset will break some components</h2>
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
            onDrop={noop}
            onRemove={handleRemove}
            onRename={handleRename}
            onSelect={onSelect}
            onDoubleSelect={noop}
            onSetOpen={onSetOpen}
            onDuplicate={handleDuplicate}
            getId={(value: string) => value.toString()}
            getChildren={getChildren}
            getLabel={(val: string) => tree.get(val)?.name ?? val}
            isOpen={isOpen}
            isSelected={(val: string) => selectedItem === val}
            isHidden={(val: string) => val === ROOT}
            canRename={canRenameNode}
            renameOnDoubleClick={isAssetNodeValue}
            canRemove={isAssetNodeValue}
            canDuplicate={canRenameNode}
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
          {tiles.map(node => {
            const valueId = getFullNodePath(node).slice(1);
            const src = node.type === 'asset' ? (node as AssetNodeItem).asset.src : undefined;
            return (
              <Tile
                key={valueId}
                valueId={valueId}
                value={node}
                getDragContext={handleDragContext}
                onClick={() => setSelectedItem(valueId)}
                onSelect={handleClickFolder(node)}
                onRemove={handleRemove}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onCopyRelativePath={operations.copyRelativePath}
                onCopyFileName={operations.copyFileName}
                selected={selectedItem === valueId}
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
