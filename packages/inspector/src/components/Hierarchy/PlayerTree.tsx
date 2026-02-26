import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { useContextMenu, Item } from 'react-contexify';
import { IoIosArrowDown, IoIosArrowForward } from 'react-icons/io';
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
import type { WithSdkProps } from '../../hoc/withSdk';
import { withSdk } from '../../hoc/withSdk';
import type { EditorComponentsTypes } from '../../lib/sdk/components';
import type { SpawnPointSelectionTarget } from '../../lib/babylon/decentraland/spawn-point-manager';
import {
  isValidSpawnAreaName,
  fromSceneSpawnPoint,
  toSceneSpawnPoint,
  generateDuplicateName,
} from '../EntityInspector/PlayerInspector/utils';
import { ContextMenu as Menu } from '../ContexMenu';
import { useContextMenu as useContextMenuAction } from '../../hooks/sdk/useContextMenu';
import { Edit } from '../Tree/Edit';
import { InfoTooltip } from '../ui';

import './PlayerTree.css';

type SpawnAreaSelection = {
  index: number | null;
  target: SpawnPointSelectionTarget;
};

type PlayerTreeProps = {
  onSelect: (entity: Entity, multiple?: boolean) => void;
};

const DISCLOSURE_SPACER_STYLE = { marginLeft: '12px' } as const;
const getLevelStyles = (level: number) => ({ paddingLeft: `${level * 10}px` });

const PlayerTree: React.FC<WithSdkProps & PlayerTreeProps> = ({ sdk, onSelect }) => {
  const { Scene } = sdk.components;
  const rootEntity = sdk.engine.RootEntity;
  const spawnPointManager = sdk.sceneContext.spawnPoints;

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
      if (spawnPointManager.isSpawnPointHidden(sp.name)) {
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
    spawnPointManager.selectSpawnPoint(null);
    onSelect(PLAYER);
  }, [spawnPointManager, onSelect]);

  const handlePlayerToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayerOpen(prev => !prev);
  }, []);

  const handleSpawnAreaClick = useCallback(
    (index: number) => {
      spawnPointManager.selectSpawnPoint(index);
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
      spawnPointManager.setSpawnPointVisible(index, name, isHidden);
    },
    [spawnPointManager, hiddenNames],
  );

  const handleToggleSpawnAreaOpen = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setOpenIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

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
        spawnPointManager.selectSpawnPoint(null);
      } else if (selection.index !== null && selection.index > index) {
        const adjustedIndex = selection.index - 1;
        if (selection.target === 'cameraTarget') {
          spawnPointManager.selectCameraTarget(adjustedIndex);
        } else {
          spawnPointManager.selectSpawnPoint(adjustedIndex);
        }
      }
    },
    [componentValue, setComponentValue, selection.index, selection.target, spawnPointManager],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
  }, [selection.index, editingIndex, handleDelete, handleDuplicate]);

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
            <div
              style={getLevelStyles(1)}
              className={cx('item', {
                selected: isSpawnAreaSelected,
              })}
              onContextMenu={e => handleSpawnAreaContextMenu(e, index)}
            >
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
                    <div>
                      {sp.name}
                      {isDefault && <span className="main-badge">(Main)</span>}
                    </div>
                  )}
                  <div className="action-area">
                    <div className="action-button">
                      <VisibilityIcon
                        isHidden={isHidden}
                        onClick={e => handleToggleVisibility(e, index, sp.name)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="Tree">
                <div
                  style={getLevelStyles(2)}
                  className={cx('item', {
                    selected: isCameraTargetSelected,
                  })}
                >
                  <div className="item-area">
                    <span style={DISCLOSURE_SPACER_STYLE} />
                    <div
                      onClick={() => handleCameraTargetClick(index)}
                      className="selectable-area"
                    >
                      <span className="tree-icon camera-target-icon" />
                      <div>Camera Target</div>
                    </div>
                  </div>
                </div>
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
      handleSpawnAreaContextMenu,
      handleRename,
      handleCancelRename,
    ],
  );

  return (
    <div className="Tree PlayerTree">
      <div
        style={getLevelStyles(0)}
        className={cx('item', { selected: isPlayerRowHighlighted })}
      >
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
            <div>Player</div>
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
      </div>

      {isPlayerOpen && spawnAreaNodes}

      <Menu id={menuId}>
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

function VisibilityIcon({
  isHidden,
  onClick,
}: {
  isHidden: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const Icon = isHidden ? InvisibleIcon : VisibleIcon;
  const className = isHidden ? 'invisible-icon' : 'visible-icon';
  return (
    <Icon
      className={className}
      size={16}
      onClick={onClick}
    />
  );
}

interface DisclosureWidgetProps {
  enabled: boolean;
  isOpen: boolean;
  onOpen: (e: React.MouseEvent) => void;
}

function DisclosureWidget({ enabled, isOpen, onOpen }: DisclosureWidgetProps) {
  if (!enabled) {
    return <span style={DISCLOSURE_SPACER_STYLE} />;
  }
  const Arrow = isOpen ? IoIosArrowDown : IoIosArrowForward;
  return <Arrow onClick={onOpen} />;
}

export default React.memo(withSdk(PlayerTree));
