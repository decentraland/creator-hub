import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineSearch as SearchIcon } from 'react-icons/ai';
import { VscClose as ClearIcon } from 'react-icons/vsc';
import type { Entity } from '@dcl/ecs';

import { CAMERA, PLAYER, ROOT, findParent } from '../../lib/sdk/tree';
import { useEntitiesWith } from '../../hooks/sdk/useEntitiesWith';
import { useTree } from '../../hooks/sdk/useTree';
import { Tree } from '../Tree';
import { withSdk } from '../../hoc/withSdk';
import './Hierarchy.css';
import { useAppSelector } from '../../redux/hooks';
import { selectCustomAssets } from '../../redux/app';
import { TextField } from '../ui';
import { ContextMenu } from './ContextMenu';
import PlayerTree from './PlayerTree';
import { filterEntityTree } from './utils';

const HierarchyIcon = withSdk<{ value: Entity }>(({ sdk, value }) => {
  const customAssets = useAppSelector(selectCustomAssets);
  const isSmart = useMemo(
    () =>
      sdk.components.Actions.has(value) ||
      sdk.components.Triggers.has(value) ||
      sdk.components.States.has(value) ||
      sdk.components.TextShape.has(value) ||
      sdk.components.NftShape.has(value) ||
      sdk.components.VisibilityComponent.has(value) ||
      sdk.components.VideoScreen.has(value) ||
      sdk.components.AdminTools.has(value),
    [sdk, value],
  );

  const isCustom = useMemo(() => {
    if (sdk.components.CustomAsset.has(value)) {
      const { assetId } = sdk.components.CustomAsset.get(value);
      const customAsset = customAssets.find(asset => asset.id === assetId);
      return !!customAsset;
    }
    return false;
  }, [sdk, value, customAssets]);

  const isTile = useMemo(() => sdk.components.Tile.has(value), [sdk, value]);

  const isGroup = useMemo(() => {
    const nodes = sdk.components.Nodes.getOrNull(ROOT)?.value;
    const node = nodes?.find(node => node.entity === value);
    return node && node.children.length > 0;
  }, [value]);

  if (value === ROOT) {
    return <span style={{ marginRight: '4px' }}></span>;
  } else if (value === PLAYER) {
    return <span className="tree-icon player-icon"></span>;
  } else if (value === CAMERA) {
    return <span className="tree-icon camera-icon"></span>;
  } else if (isCustom) {
    return <span className="tree-icon custom-icon"></span>;
  } else if (isGroup) {
    return <span className="tree-icon group-icon"></span>;
  } else if (isSmart) {
    return <span className="tree-icon smart-icon"></span>;
  } else if (isTile) {
    return <span className="tree-icon tile-icon"></span>;
  } else {
    return <span className="tree-icon entity-icon"></span>;
  }
});

const EntityTree = Tree<Entity>();

const Hierarchy = withSdk(({ sdk }) => {
  const spawnPointManager = sdk.renderer.spawnPoints;
  const {
    tree,
    addChild,
    setParent,
    remove,
    rename,
    select,
    setOpen,
    duplicate,
    getId,
    getChildren,
    getLabel,
    getSelectedItems,
    isOpen,
    isHidden,
    canRename,
    canRemove,
    canDuplicate,
    canDrag,
    canReorder,
    centerViewOnEntity,
    isRoot,
  } = useTree();
  const selectedEntities = useEntitiesWith(components => components.Selection);
  const [lastSelectedItem, setLastSelectedItem] = useState<Entity | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [scrollTarget, setScrollTarget] = useState<Entity | null>(null);
  const hierarchyRef = useRef<HTMLDivElement>(null);

  const searchTerm = search.trim().toLowerCase();

  // Entities that match the search (or have a matching descendant), or null when not filtering
  const visibleEntities = useMemo(
    () => (searchTerm ? filterEntityTree([ROOT, CAMERA], getChildren, getLabel, searchTerm) : null),
    [searchTerm, getChildren, getLabel],
  );
  const isFiltering = visibleEntities !== null;

  const getFilteredChildren = useCallback(
    (entity: Entity) => {
      const children = getChildren(entity);
      return visibleEntities ? children.filter(child => visibleEntities.has(child)) : children;
    },
    [getChildren, visibleEntities],
  );

  const isOpenInTree = useCallback(
    (entity: Entity) => (visibleEntities ? true : isOpen(entity)),
    [isOpen, visibleEntities],
  );

  const isHiddenInTree = useCallback(
    (entity: Entity) => (visibleEntities ? !visibleEntities.has(entity) : isHidden(entity)),
    [isHidden, visibleEntities],
  );

  const handleSetOpen = useCallback(
    (entity: Entity, open: boolean) => {
      // while filtering, matches are forced open; don't touch the persisted open state
      if (isFiltering) return;
      void setOpen(entity, open);
    },
    [isFiltering, setOpen],
  );

  const isSelected = useCallback(
    (entity: Entity) => {
      return selectedEntities.includes(entity);
    },
    [selectedEntities],
  );

  const getAllVisibleEntities = useCallback(() => {
    const entities: Entity[] = [];

    const traverse = (entity: Entity) => {
      if (!isHiddenInTree(entity)) {
        entities.push(entity);
        if (isOpenInTree(entity)) {
          getFilteredChildren(entity).forEach(child => traverse(child));
        }
      }
    };

    traverse(ROOT);

    return entities;
  }, [getFilteredChildren, isOpenInTree, isHiddenInTree]);

  const handleRangeSelection = useCallback(
    (fromEntity: Entity, toEntity: Entity) => {
      const allEntities = getAllVisibleEntities();
      const fromIndex = allEntities.findIndex(e => getId(e) === getId(fromEntity));
      const toIndex = allEntities.findIndex(e => getId(e) === getId(toEntity));

      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);

      allEntities.forEach((entity, index) => {
        if (index >= startIndex && index <= endIndex) {
          void select(entity, index > startIndex); // first item replaces selection, others add to selection
        }
      });
    },
    [getAllVisibleEntities, getId, select],
  );

  const handleSelect = useCallback(
    (entity: Entity, clickType?: 'single' | 'ctrl' | 'shift') => {
      if (clickType === 'shift' && lastSelectedItem) {
        handleRangeSelection(lastSelectedItem, entity);
      } else {
        const isMultipleSelection = clickType === 'ctrl' || clickType === 'shift';
        void select(entity, isMultipleSelection);
      }
    },
    [select, lastSelectedItem, handleRangeSelection],
  );

  const handleLastSelectedChange = useCallback(
    (entity: Entity) => {
      if (entity !== lastSelectedItem) setLastSelectedItem(entity);
    },
    [lastSelectedItem],
  );

  /** Deselect entities when clicking on the background of the hierarchy. */
  const handleBackgroundDeselect = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return; // Ignore clicks on children elements
      spawnPointManager.select(null);
      void select(ROOT, false);
    },
    [select, spawnPointManager],
  );

  /** Open every collapsed ancestor of an entity so its row is rendered in the tree. */
  const revealInTree = useCallback(
    async (entity: Entity) => {
      const ancestors: Entity[] = [];
      let current = entity;
      while (current !== ROOT && current !== PLAYER && current !== CAMERA) {
        const parent = findParent(tree, current);
        if (parent === current || ancestors.includes(parent)) break;
        ancestors.push(parent);
        current = parent;
      }
      for (const ancestor of ancestors) {
        if (!isOpen(ancestor)) {
          await setOpen(ancestor, true);
        }
      }
    },
    [tree, isOpen, setOpen],
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    // keep the current selection visible after the filter is removed
    const selected = selectedEntities.find(entity => entity !== ROOT);
    if (selected !== undefined) {
      void revealInTree(selected);
      setScrollTarget(selected);
    }
  }, [selectedEntities, revealInTree]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.currentTarget.blur();
        handleClearSearch();
      }
    },
    [handleClearSearch],
  );

  // scroll to the entity that was selected when the search was cleared; retries across
  // renders since its row only exists once collapsed ancestors are re-opened
  useEffect(() => {
    if (scrollTarget === null || isFiltering) return;
    const row = hierarchyRef.current?.querySelector(
      `.Tree[data-test-id="${scrollTarget}"] > .item`,
    );
    if (row) {
      row.scrollIntoView({ block: 'center' });
      setScrollTarget(null);
    }
  }, [scrollTarget, isFiltering, tree]);

  const showPlayer = !isFiltering || 'player'.includes(searchTerm);

  const props = {
    getExtraContextMenu: ContextMenu,
    onAddChild: addChild,
    onDrop: setParent,
    onRemove: remove,
    onRename: rename,
    onSelect: handleSelect,
    onDoubleSelect: centerViewOnEntity,
    onSetOpen: handleSetOpen,
    onDuplicate: duplicate,
    getId: getId,
    getChildren: getFilteredChildren,
    getLabel: getLabel,
    getSelectedItems: getSelectedItems,
    getIcon: (val: Entity) => <HierarchyIcon value={val} />,
    isOpen: isOpenInTree,
    isSelected: isSelected,
    isHidden: isHiddenInTree,
    canRename: canRename,
    canRemove: canRemove,
    canDuplicate: canDuplicate,
    canDrag: canDrag,
    canReorder: canReorder,
    onLastSelectedChange: handleLastSelectedChange,
    isRoot: isRoot,
  };

  return (
    <div
      className="Hierarchy"
      ref={hierarchyRef}
    >
      <div
        className="Hierarchy-search"
        onContextMenu={e => e.stopPropagation()}
      >
        <TextField
          placeholder="Search entities"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          leftIcon={<SearchIcon />}
          rightIcon={
            search ? (
              <ClearIcon
                className="ClearSearch"
                onClick={handleClearSearch}
              />
            ) : undefined
          }
        />
      </div>
      <div
        className="Hierarchy-tree"
        onClick={handleBackgroundDeselect}
      >
        {showPlayer && (
          <PlayerTree onSelect={(entity, multiple) => void select(entity, !!multiple)} />
        )}
        <EntityTree
          value={CAMERA}
          {...props}
        />
        <EntityTree
          value={ROOT}
          {...props}
        />
      </div>
    </div>
  );
});

export default React.memo(Hierarchy);
