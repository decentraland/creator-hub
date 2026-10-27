import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { useContextMenu, Item } from 'react-contexify';
import { IoEyeOutline as VisibleIcon, IoEyeOffOutline as InvisibleIcon } from 'react-icons/io5';
import { AiFillDelete as DeleteIcon } from 'react-icons/ai';
import {
  MdOutlineDriveFileRenameOutline as RenameIcon,
  MdContentCopy as DuplicateIcon,
} from 'react-icons/md';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';

import { PLAYER } from '../../lib/sdk/tree';
import { useEntitiesWith } from '../../hooks/sdk/useEntitiesWith';
import { useComponentValue } from '../../hooks/sdk/useComponentValue';
import { useAppSelector } from '../../redux/hooks';
import { isAssetExplorerActive } from '../../redux/ui';
import type { WithSdkProps } from '../../hoc/withSdk';
import { withSdk } from '../../hoc/withSdk';
import type { EditorComponentsTypes } from '../../lib/sdk/components';
import type { SpawnPointTarget } from '../../lib/renderer/types';
import {
  isValidSpawnAreaName,
  fromSceneSpawnPoint,
  toSceneSpawnPoint,
  generateDuplicateName,
} from '../EntityInspector/PlayerInspector/utils';
import { ContextMenu as Menu } from '../ContexMenu';
import { useContextMenu as useContextMenuAction } from '../../hooks/sdk/useContextMenu';
import { Edit } from '../Tree/Edit';
import { DisclosureWidget } from '../Tree/Tree';
import { useTreeItem, type TreeItemActions } from '../Tree/TreeRoot';
import { InfoTooltip } from '../ui';

import './PlayerTree.css';

type SpawnAreaSelection = {
  index: number | null;
  target: SpawnPointTarget | null;
};

type PlayerTreeProps = {
  onSelect: (entity: Entity, multiple?: boolean) => void;
};

const getLevelStyles = (level: number) => ({ '--tree-level': level }) as React.CSSProperties;

type PlayerTreeItemProps = {
  id: string;
  level: number;
  selected: boolean;
  expanded?: boolean;
  actions: TreeItemActions;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: (row: { tabIndex: 0 | -1; labelId: string }) => React.ReactNode;
};

function PlayerTreeItem({
  id,
  level,
  selected,
  expanded,
  actions,
  onContextMenu,
  children,
}: PlayerTreeItemProps) {
  const { tabIndex } = useTreeItem(id, actions);
  const labelId = useId();
  return (
    <div
      style={getLevelStyles(level)}
      className={cx('item', { selected })}
      role="treeitem"
      aria-level={level + 1}
      aria-selected={selected ? 'true' : 'false'}
      aria-expanded={expanded}
      aria-labelledby={labelId}
      data-tree-id={id}
      tabIndex={tabIndex}
      onContextMenu={onContextMenu}
    >
      {children({ tabIndex, labelId })}
    </div>
  );
}

const PlayerTree: React.FC<WithSdkProps & PlayerTreeProps> = ({ sdk, onSelect }) => {
  const { Scene } = sdk.components;
  const rootEntity = sdk.engine.RootEntity;
  const spawnPointManager = sdk.renderer.spawnPoints;

  const [componentValue, setComponentValue] = useComponentValue<EditorComponentsTypes['Scene']>(
    rootEntity,
    Scene,
  );
  const spawnPoints = componentValue?.spawnPoints ?? [];

  const menuId = useId();
  const { show } = useContextMenu({ id: menuId });
  const { handleAction } = useContextMenuAction();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);

  const selectedEntities = useEntitiesWith(components => components.Selection);
  const isPlayerSelected = selectedEntities.includes(PLAYER);

  const [selection, setSelection] = useState<SpawnAreaSelection>(() => ({
    index: spawnPointManager.getSelectedIndex(),
    target: spawnPointManager.getSelectedTarget(),
  }));

  const [isPlayerOpen, setIsPlayerOpen] = useState(true);
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(() => {
    const names = new Set<string>();
    for (const sp of spawnPoints) {
      if (spawnPointManager.isHidden(sp.name)) {
        names.add(sp.name);
      }
    }
    return names;
  });

  useEffect(() => {
    const unsubscribe = spawnPointManager.onSelectionChange(({ index, target }) => {
      setSelection({ index, target });
      if (index !== null) {
        setIsPlayerOpen(true);
      }
    });
    return () => unsubscribe();
  }, [spawnPointManager]);

  useEffect(() => {
    const unsubscribe = spawnPointManager.onVisibilityChange(({ name, visible }) => {
      setHiddenNames(prev => {
        const next = new Set(prev);
        if (visible) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    });
    return () => unsubscribe();
  }, [spawnPointManager]);

  const handlePlayerClick = useCallback(() => {
    spawnPointManager.select(null);
    onSelect(PLAYER);
  }, [spawnPointManager, onSelect]);

  const handlePlayerToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayerOpen(prev => !prev);
  }, []);

  const handleSpawnAreaClick = useCallback(
    (index: number) => {
      spawnPointManager.select(index);
      onSelect(PLAYER);
    },
    [spawnPointManager, onSelect],
  );

  const handleCameraTargetClick = useCallback(
    (index: number) => {
      spawnPointManager.selectCameraTarget(index);
      onSelect(PLAYER);
    },
    [spawnPointManager, onSelect],
  );

  const handleToggleVisibility = useCallback(
    (e: React.MouseEvent, index: number, name: string) => {
      e.stopPropagation();
      const isHidden = hiddenNames.has(name);
      spawnPointManager.setVisible(index, name, isHidden);
    },
    [spawnPointManager, hiddenNames],
  );

  const setSpawnAreaOpen = useCallback((index: number, open: boolean) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      if (open) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }, []);

  const handleToggleSpawnAreaOpen = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      setSpawnAreaOpen(index, !openIndices.has(index));
    },
    [openIndices, setSpawnAreaOpen],
  );

  const handleSpawnAreaContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuIndex(index);
      show({ event: e });
    },
    [show],
  );

  const handleRename = useCallback(
    (index: number, newName: string) => {
      setEditingIndex(null);
      if (!isValidSpawnAreaName(newName) || !componentValue?.spawnPoints) return;
      const updatedSpawnPoints = componentValue.spawnPoints.map((sp, i) =>
        i === index ? { ...sp, name: newName } : sp,
      );
      setComponentValue({ ...componentValue, spawnPoints: updatedSpawnPoints });
    },
    [componentValue, setComponentValue],
  );

  const handleCancelRename = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleDuplicate = useCallback(
    (index: number) => {
      if (!componentValue?.spawnPoints) return;
      const sp = componentValue.spawnPoints[index];
      if (!sp) return;
      const input = fromSceneSpawnPoint(sp);
      const existingNames = componentValue.spawnPoints.map(s => s.name);
      const name = generateDuplicateName(sp.name, existingNames);
      const duplicate = toSceneSpawnPoint({ ...input, name, default: false });
      const updatedSpawnPoints = [...componentValue.spawnPoints, duplicate];
      setComponentValue({ ...componentValue, spawnPoints: updatedSpawnPoints });
    },
    [componentValue, setComponentValue],
  );

  const handleDelete = useCallback(
    (index: number) => {
      if (!componentValue?.spawnPoints || componentValue.spawnPoints.length <= 1) return;
      const deletedWasDefault = componentValue.spawnPoints[index].default;
      let updatedSpawnPoints = componentValue.spawnPoints.filter((_, i) => i !== index);
      if (deletedWasDefault && !updatedSpawnPoints.some(sp => sp.default)) {
        updatedSpawnPoints = updatedSpawnPoints.map((sp, i) =>
          i === 0 ? { ...sp, default: true } : sp,
        );
      }
      setComponentValue({ ...componentValue, spawnPoints: updatedSpawnPoints });
      if (selection.index === index) {
        spawnPointManager.select(null);
      } else if (selection.index !== null && selection.index > index) {
        const adjustedIndex = selection.index - 1;
        if (selection.target === 'cameraTarget') {
          spawnPointManager.selectCameraTarget(adjustedIndex);
        } else {
          spawnPointManager.select(adjustedIndex);
        }
      }
    },
    [componentValue, setComponentValue, selection.index, selection.target, spawnPointManager],
  );

  const assetExplorerActive = useAppSelector(isAssetExplorerActive);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (assetExplorerActive) return;
      if (editingIndex !== null) return;
      if (selection.index === null) return;

      const isDelete = e.key === 'Delete' || e.key === 'Backspace';
      const isDuplicate = (e.metaKey || e.ctrlKey) && e.key === 'd';

      if (isDelete) {
        e.preventDefault();
        e.stopPropagation();
        handleDelete(selection.index);
      } else if (isDuplicate) {
        e.preventDefault();
        e.stopPropagation();
        handleDuplicate(selection.index);
      }
    };

    document.body.addEventListener('keydown', handler, true);
    return () => document.body.removeEventListener('keydown', handler, true);
  }, [selection.index, editingIndex, assetExplorerActive, handleDelete, handleDuplicate]);

  const isPlayerRowHighlighted = isPlayerSelected && selection.index === null;

  const spawnAreaNodes = useMemo(
    () =>
      spawnPoints.map((sp, index) => {
        const isSpawnAreaSelected = selection.index === index && selection.target === 'position';
        const isCameraTargetSelected =
          selection.index === index && selection.target === 'cameraTarget';
        const isHidden = hiddenNames.has(sp.name);
        const isOpen = openIndices.has(index);
        const isDefault = sp.default === true;

        return (
          <div
            className="Tree"
            key={`spawn-area-${sp.name}-${index}`}
          >
            <PlayerTreeItem
              id={`spawn-${index}`}
              level={1}
              selected={isSpawnAreaSelected}
              expanded={isOpen}
              actions={{
                select: mode => {
                  if (mode === 'single') handleSpawnAreaClick(index);
                },
                setOpen: open => setSpawnAreaOpen(index, open),
              }}
              onContextMenu={e => handleSpawnAreaContextMenu(e, index)}
            >
              {({ tabIndex, labelId }) => (
                <div className="item-area">
                  <DisclosureWidget
                    enabled
                    isOpen={isOpen}
                    onOpen={e => handleToggleSpawnAreaOpen(e, index)}
                  />
                  <div
                    onClick={() => handleSpawnAreaClick(index)}
                    className="selectable-area"
                  >
                    <span className="tree-icon spawn-area-icon" />
                    {editingIndex === index ? (
                      <Edit
                        value={sp.name}
                        onSubmit={newName => handleRename(index, newName)}
                        onCancel={handleCancelRename}
                      />
                    ) : (
                      <div
                        className="label"
                        id={labelId}
                      >
                        {sp.name}
                        {isDefault && (
                          <>
                            {' '}
                            <span className="main-badge">(Main)</span>
                          </>
                        )}
                      </div>
                    )}
                    <div className={cx('action-area', { 'is-hidden': isHidden })}>
                      <button
                        type="button"
                        className="action-button"
                        aria-label={`Hide ${sp.name}`}
                        aria-pressed={isHidden}
                        tabIndex={tabIndex}
                        onClick={e => handleToggleVisibility(e, index, sp.name)}
                      >
                        <VisibilityIcon isHidden={isHidden} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </PlayerTreeItem>

            {isOpen && (
              <div className="Tree">
                <PlayerTreeItem
                  id={`camera-target-${index}`}
                  level={2}
                  selected={isCameraTargetSelected}
                  actions={{
                    select: mode => {
                      if (mode === 'single') handleCameraTargetClick(index);
                    },
                  }}
                >
                  {({ labelId }) => (
                    <div className="item-area">
                      <span
                        className="caret"
                        aria-hidden="true"
                      />
                      <div
                        onClick={() => handleCameraTargetClick(index)}
                        className="selectable-area"
                      >
                        <span className="tree-icon camera-target-icon" />
                        <div
                          className="label"
                          id={labelId}
                        >
                          Camera Target
                        </div>
                      </div>
                    </div>
                  )}
                </PlayerTreeItem>
              </div>
            )}
          </div>
        );
      }),
    [
      spawnPoints,
      selection,
      hiddenNames,
      openIndices,
      editingIndex,
      handleSpawnAreaClick,
      handleCameraTargetClick,
      handleToggleVisibility,
      handleToggleSpawnAreaOpen,
      setSpawnAreaOpen,
      handleSpawnAreaContextMenu,
      handleRename,
      handleCancelRename,
    ],
  );

  return (
    <div className="Tree PlayerTree">
      <PlayerTreeItem
        id="player"
        level={0}
        selected={isPlayerRowHighlighted}
        expanded={spawnPoints.length > 0 ? isPlayerOpen : undefined}
        actions={{
          select: mode => {
            spawnPointManager.select(null);
            onSelect(PLAYER, mode === 'extend');
          },
          setOpen: spawnPoints.length > 0 ? setIsPlayerOpen : undefined,
        }}
      >
        {({ labelId }) => (
          <div className="item-area">
            <DisclosureWidget
              enabled={spawnPoints.length > 0}
              isOpen={isPlayerOpen}
              onOpen={handlePlayerToggle}
            />
            <div
              onClick={handlePlayerClick}
              className="selectable-area"
            >
              <span className="tree-icon player-icon" />
              <div
                className="label"
                id={labelId}
              >
                Player
              </div>
              <div className="action-area">
                <div className="action-button">
                  <InfoTooltip
                    text={
                      <>
                        The player&apos;s avatar. Nested items are fixed to the player&apos;s
                        position.&nbsp;
                        <a
                          href="https://docs.decentraland.org/creator/scene-editor/get-started/scene-editor-essentials#special-entities"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Learn more
                        </a>
                      </>
                    }
                    type="info"
                    position="right center"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </PlayerTreeItem>

      {isPlayerOpen && spawnAreaNodes}

      <Menu
        id={menuId}
        label="Spawn Point Options"
      >
        <Item
          onClick={handleAction(() => {
            if (contextMenuIndex !== null) setEditingIndex(contextMenuIndex);
          })}
        >
          <RenameIcon /> Rename
        </Item>
        <Item
          onClick={handleAction(() => {
            if (contextMenuIndex !== null) handleDuplicate(contextMenuIndex);
          })}
        >
          <DuplicateIcon /> Duplicate
        </Item>
        <Item
          disabled={spawnPoints.length <= 1}
          onClick={handleAction(() => {
            if (contextMenuIndex !== null) handleDelete(contextMenuIndex);
          })}
        >
          <DeleteIcon /> Delete
        </Item>
      </Menu>
    </div>
  );
};

function VisibilityIcon({ isHidden }: { isHidden: boolean }) {
  const Icon = isHidden ? InvisibleIcon : VisibleIcon;
  const className = isHidden ? 'invisible-icon' : 'visible-icon';
  return (
    <Icon
      className={className}
      size={16}
      aria-hidden="true"
    />
  );
}

export default React.memo(withSdk(PlayerTree));
