import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import {
  MdChevronRight as ChevronIcon,
  MdUnfoldLess as CollapseAllIcon,
  MdUnfoldMore as ExpandAllIcon,
  MdViewList as ListIcon,
  MdGridView as GridIcon,
} from 'react-icons/md';
import { BsLayoutSidebarInset as TreeIcon } from 'react-icons/bs';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { Tree } from '../Tree';
import { Modal } from '../Modal';
import { Button } from '../Button';
import FolderIcon from '../Icons/Folder';
import Search from '../Search';
import { transformBinaryToBase64Resource, withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { removeAsset } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { determineAssetType, extractFileExtension } from '../ImportAsset/utils';
import { getThumbnailHashNameForAsset } from '../../lib/utils/hash';
import { useAssetSelection } from '../AssetBrowserPreview';
import { getFilterFromTree, getFullNodePath } from './utils';
import type { AssetNodeFolder, AssetNodeItem } from './types';
import { Tile } from './Tile';
import { getLocalThumbnail, invalidateLocalThumbnail } from './localThumbnails';
import { generateAssetTree, getChildren as _getChildren, TreeNode, ROOT, getTiles } from './tree';
import { Filters } from './Filters';
import { Filter } from './Filters/types';

export { TreeNode };

function noop() {}

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
  const { selection, select } = useAssetSelection();
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [showTree, setShowTree] = useState(true);
  const [treeWidth, setTreeWidth] = useState(readTreeWidth);
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(new Set<string>());
  const [modal, setModal] = useState<ModalState | undefined>(undefined);
  const [lastSelected, setLastSelected] = useState<string>(ROOT);
  const [search, setSearch] = useState<string>('');
  const [tree, setTree] = useState<Map<string, TreeNode>>(new Map());
  const [filters, setFilters] = useState<Filter[]>([]);
  const [activeFilter, setActiveFilter] = useState(Filter.All);

  useEffect(() => {
    const { tree, filters } = generateAssetTree(folders, open, search, activeFilter);
    setTree(tree);
    setFilters(getFilterFromTree(filters));
  }, [folders, search, activeFilter]);

  /**
   * Callbacks
   */

  const onSelect = useCallback(
    (value: string) => {
      open.add(value);
      const node = tree.get(value);
      if (node?.type === 'asset') {
        // Keep the file's folder in view so its neighbours stay visible, and preview the file.
        setLastSelected(value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : ROOT);
        select({ source: 'local', id: value, name: node.name, path: value });
        return;
      }
      setLastSelected(value);
    },
    [setLastSelected, tree, select],
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
      invalidateLocalThumbnail(getFullNodePath(tree.get(value)!).slice(1));
      dispatch(removeAsset({ path }));
    },
    [tree, getEntitiesWithAsset],
  );

  const handleConfirm = useCallback(async () => {
    if (!modal) return;
    dispatch(removeAsset({ path: modal.value }));
    invalidateLocalThumbnail(modal.value.replace(/^assets\//, ''));
    setModal(undefined);
  }, [modal, setModal]);

  const handleModalClose = useCallback(() => setModal(undefined), []);

  const handleClickFolder = useCallback(
    (node: TreeNode) => () => {
      if (node.type === 'asset') return;
      const path = getFullNodePath(node).slice(1);
      open.add(path);
      setLastSelected(path);
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

  const getThumbnail = useCallback(
    async (value: AssetNodeItem) => {
      // First try to find thumbnail using hash-based lookup
      const hashedThumbnailName = await getThumbnailHashNameForAsset(value.asset.src);
      let thumbnail = thumbnails.find($ => $.path.endsWith(hashedThumbnailName));
      if (!thumbnail) {
        // Fallback to legacy name-based lookup for backwards compatibility
        const [name] = value.name.split('.');
        thumbnail = thumbnails.find($ => $.path.endsWith(name + '.png'));
      }
      if (thumbnail) return transformBinaryToBase64Resource(thumbnail.content);
      // Nothing stored: images show themselves and models get rendered once.
      return getLocalThumbnail(value.asset.src);
    },
    [thumbnails],
  );

  const handleFilterClick = useCallback((type: Filter) => {
    setActiveFilter(type);
  }, []);

  const tiles = getTiles(lastSelected, tree, search, activeFilter);
  const folderTiles = tiles.filter(node => node.type === 'folder');
  const assetTiles = tiles.filter(node => node.type === 'asset');
  const crumbs = getBreadcrumbs(lastSelected);
  // Search and type filters look through every folder, so results need their own context.
  const isFiltering = !!search || (activeFilter !== Filter.All && activeFilter !== Filter.Recents);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setActiveFilter(Filter.All);
  }, []);

  const allFolderIds = useMemo(
    () => [...tree.entries()].filter(([, node]) => node.type === 'folder').map(([id]) => id),
    [tree],
  );
  const allExpanded = allFolderIds.every(id => open.has(id));

  const handleToggleAll = useCallback(
    () => setOpen(new Set(allExpanded ? [ROOT] : allFolderIds)),
    [allExpanded, allFolderIds],
  );

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = treeWidth;
      let latest = startWidth;
      const onMove = (move: PointerEvent) => {
        latest = Math.min(
          MAX_TREE_WIDTH,
          Math.max(MIN_TREE_WIDTH, startWidth + move.clientX - startX),
        );
        setTreeWidth(latest);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        try {
          localStorage.setItem(TREE_WIDTH_KEY, String(latest));
        } catch {
          // the width just won't be remembered
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [treeWidth],
  );

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // storage can be unavailable (private windows, blocked site data); the choice just won't stick
    }
  }, []);

  const renderTile = (node: TreeNode) => {
    const valueId = getFullNodePath(node).slice(1);
    return (
      <Tile
        key={valueId}
        valueId={valueId}
        value={node}
        layout={viewMode}
        showPath={isFiltering}
        getDragContext={handleDragContext}
        onSelect={handleClickFolder(node)}
        onRemove={handleRemove}
        getThumbnail={getThumbnail}
        dndType={DRAG_N_DROP_ASSET_KEY}
      />
    );
  };

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
      <div className="ProjectView">
        <div
          className={cx('Tree-View', { collapsed: !showTree })}
          style={{ width: treeWidth }}
        >
          <div className="Tree-View-header">
            <span>Folders</span>
            <button
              className="Assets-iconButton small"
              onClick={handleToggleAll}
              title={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
              aria-label={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
            >
              {allExpanded ? <CollapseAllIcon /> : <ExpandAllIcon />}
            </button>
          </div>
          <FilesTree
            className="editor-assets-tree"
            value={ROOT}
            onAddChild={noop}
            onDrop={noop}
            onRemove={handleRemove}
            onRename={noop}
            onSelect={onSelect}
            onDoubleSelect={noop}
            onSetOpen={onSetOpen}
            onDuplicate={noop}
            getId={(value: string) => value.toString()}
            getChildren={getChildren}
            getLabel={(val: string) => (
              <span
                className={cx({ 'is-current': val === lastSelected })}
                title={tree.get(val)?.name ?? val}
              >
                {tree.get(val)?.name ?? val}
              </span>
            )}
            isOpen={isOpen}
            isSelected={(val: string) => selection?.source === 'local' && selection.id === val}
            isHidden={(val: string) => val === ROOT}
            canRename={() => false}
            canRemove={val => tree.get(val)?.type === 'asset'}
            canDuplicate={() => false}
            canAddChild={() => false}
            getIcon={val => <NodeIcon value={tree.get(val)} />}
            getDragContext={handleDragContext}
            getDragItem={handleDragItem}
            dndType={DRAG_N_DROP_ASSET_KEY}
          />
        </div>
        {showTree && (
          <div
            className="ProjectView-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize folder tree"
            onPointerDown={handleResizeStart}
            onDoubleClick={() => setTreeWidth(DEFAULT_TREE_WIDTH)}
          />
        )}
        <div className="ProjectView-main">
          <div className="ProjectView-toolbar">
            <button
              className={cx('Assets-iconButton', { active: showTree })}
              onClick={() => setShowTree(value => !value)}
              title={showTree ? 'Hide folder tree' : 'Show folder tree'}
              aria-label={showTree ? 'Hide folder tree' : 'Show folder tree'}
              aria-pressed={showTree}
            >
              <TreeIcon />
            </button>
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Search local assets"
              onCancel={() => setSearch('')}
            />
            <Filters
              filters={filters}
              active={activeFilter}
              onClick={handleFilterClick}
            />
            <div
              className="ProjectView-viewToggle"
              role="group"
              aria-label="View mode"
            >
              <button
                className={cx('Assets-iconButton', { active: viewMode === 'grid' })}
                onClick={() => handleViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <GridIcon />
              </button>
              <button
                className={cx('Assets-iconButton', { active: viewMode === 'list' })}
                onClick={() => handleViewMode('list')}
                title="List view"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <ListIcon />
              </button>
            </div>
          </div>
          {isFiltering ? (
            <div className="Assets-crumbs Assets-crumbs-scope">
              <span>
                {assetTiles.length} {assetTiles.length === 1 ? 'result' : 'results'} in all folders
              </span>
              <button onClick={handleClearFilters}>Clear</button>
            </div>
          ) : (
            <nav
              className="Assets-crumbs"
              aria-label="Folder path"
            >
              {crumbs.map((crumb, index) => (
                <React.Fragment key={crumb.path}>
                  {index > 0 && <ChevronIcon />}
                  <button
                    className={cx({ current: index === crumbs.length - 1 })}
                    onClick={() => setLastSelected(crumb.path)}
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}
          <div className="ProjectView-scroll">
            {folderTiles.length > 0 && (
              <div className="FolderView ProjectView-folders">{folderTiles.map(renderTile)}</div>
            )}
            {assetTiles.length > 0 && (
              <div className={cx('FolderView', 'ProjectView-files', viewMode)}>
                {assetTiles.map(renderTile)}
              </div>
            )}
            {tiles.length === 0 && (
              <div className="ProjectView-empty">
                {search || activeFilter !== Filter.All
                  ? 'No assets match your search.'
                  : 'This folder is empty.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'inspector:local-assets-view';
const TREE_WIDTH_KEY = 'inspector:local-assets-tree-width';
const DEFAULT_TREE_WIDTH = 180;
const MIN_TREE_WIDTH = 130;
const MAX_TREE_WIDTH = 380;

function readTreeWidth(): number {
  try {
    const stored = Number(localStorage.getItem(TREE_WIDTH_KEY));
    if (stored >= MIN_TREE_WIDTH && stored <= MAX_TREE_WIDTH) return stored;
  } catch {
    // fall through to the default
  }
  return DEFAULT_TREE_WIDTH;
}

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function getBreadcrumbs(path: string): { label: string; path: string }[] {
  const crumbs = [{ label: 'Assets', path: ROOT }];
  if (path === ROOT) return crumbs;
  const parts = path.split('/');
  parts.forEach((part, index) =>
    crumbs.push({ label: part, path: parts.slice(0, index + 1).join('/') }),
  );
  return crumbs;
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
