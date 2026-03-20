import React, { useCallback, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { CAMERA, ROOT } from '../../lib/sdk/tree';
import { useEntitiesWith } from '../../hooks/sdk/useEntitiesWith';
import { useTree } from '../../hooks/sdk/useTree';
import { Tree } from '../Tree';
import { withSdk } from '../../hoc/withSdk';
import './Hierarchy.css';
import { ContextMenu } from './ContextMenu';
import PlayerTree from './PlayerTree';
import EntityIcon from './EntityIcon';

const EntityTree = Tree<Entity>();

const Hierarchy = withSdk(({ sdk }) => {
  const spawnPointManager = sdk.sceneContext.spawnPoints;
  const {
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

  const isSelected = useCallback(
    (entity: Entity) => {
      return selectedEntities.includes(entity);
    },
    [selectedEntities],
  );

  const getAllVisibleEntities = useCallback(() => {
    const entities: Entity[] = [];

    const traverse = (entity: Entity) => {
      if (!isHidden(entity)) {
        entities.push(entity);
        if (isOpen(entity)) {
          getChildren(entity).forEach(child => traverse(child));
        }
      }
    };

    traverse(ROOT);

    return entities;
  }, [getChildren, isOpen, isHidden]);

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
      spawnPointManager.selectSpawnPoint(null);
      void select(ROOT, false);
    },
    [select, spawnPointManager],
  );

  const props = {
    getExtraContextMenu: ContextMenu,
    onAddChild: addChild,
    onDrop: setParent,
    onRemove: remove,
    onRename: rename,
    onSelect: handleSelect,
    onDoubleSelect: centerViewOnEntity,
    onSetOpen: setOpen,
    onDuplicate: duplicate,
    getId: getId,
    getChildren: getChildren,
    getLabel: getLabel,
    getSelectedItems: getSelectedItems,
    getIcon: (val: Entity) => <EntityIcon value={val} />,
    isOpen: isOpen,
    isSelected: isSelected,
    isHidden: isHidden,
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
      onClick={handleBackgroundDeselect}
    >
      <PlayerTree onSelect={(entity, multiple) => void select(entity, !!multiple)} />
      <EntityTree
        value={CAMERA}
        {...props}
      />
      <EntityTree
        value={ROOT}
        {...props}
      />
    </div>
  );
});

export default React.memo(Hierarchy);
