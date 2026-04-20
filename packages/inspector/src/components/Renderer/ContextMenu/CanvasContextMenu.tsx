import React, { useCallback, useEffect, useState } from 'react';
import { Item, Menu, Separator, contextMenu } from 'react-contexify';
import type { Entity } from '@dcl/ecs';
import { AiFillDelete as DeleteIcon, AiFillCopy as DuplicateIcon } from 'react-icons/ai';

import { useContextMenu } from '../../../hooks/sdk/useContextMenu';
import { useTree } from '../../../hooks/sdk/useTree';
import { useSdk } from '../../../hooks/sdk/useSdk';
import { ROOT } from '../../../lib/sdk/tree';
import { ContextMenu as HierarchyContextMenu } from '../../Hierarchy/ContextMenu';
import './CanvasContextMenu.css';

export const CANVAS_CONTEXT_MENU_ID = 'canvas-entity-context-menu';

function EntityHeader({ entity }: { entity: Entity }) {
  const sdk = useSdk();
  if (!sdk) return null;

  const name = sdk.components.Name.getOrNull(entity)?.value ?? String(entity);

  let iconClass = 'entity-icon';
  if (
    sdk.components.Actions.has(entity) ||
    sdk.components.Triggers.has(entity) ||
    sdk.components.States.has(entity) ||
    sdk.components.TextShape.has(entity) ||
    sdk.components.NftShape.has(entity) ||
    sdk.components.VisibilityComponent.has(entity) ||
    sdk.components.VideoScreen.has(entity) ||
    sdk.components.AdminTools.has(entity)
  ) {
    iconClass = 'smart-icon';
  } else if (sdk.components.Tile.has(entity)) {
    iconClass = 'tile-icon';
  } else if (sdk.components.CustomAsset.has(entity)) {
    iconClass = 'custom-icon';
  } else {
    const nodes = sdk.components.Nodes.getOrNull(ROOT)?.value;
    const node = nodes?.find(n => n.entity === entity);
    if (node && node.children.length > 0) iconClass = 'group-icon';
  }

  return (
    <div className="CanvasContextMenu__header">
      <span className={`CanvasContextMenu__icon ${iconClass}`} />
      <span className="CanvasContextMenu__entity-name">{name}</span>
    </div>
  );
}

function CanvasContextMenuItems({ entity }: { entity: Entity }) {
  const { handleAction } = useContextMenu();
  const sdk = useSdk();
  const { canRemove, canDuplicate } = useTree();
  const extra = HierarchyContextMenu(entity);

  const handleRemove = () => {
    if (!sdk) return;
    const selectedEntities = sdk.operations.getSelectedEntities();
    const entitiesToRemove = selectedEntities.length > 1 ? selectedEntities : [entity];
    entitiesToRemove.forEach(e => sdk.operations.removeEntity(e));
    void sdk.operations.dispatch();
  };

  const handleDuplicate = () => {
    if (!sdk) return;
    const selectedEntities = sdk.operations.getSelectedEntities();
    const preferredGizmo =
      selectedEntities.length > 0
        ? sdk.components.Selection.getOrNull(selectedEntities[0])?.gizmo
        : undefined;
    sdk.operations.removeSelectedEntities();
    const entitiesToDuplicate = selectedEntities.length > 1 ? selectedEntities : [entity];
    entitiesToDuplicate.forEach(e => sdk.operations.duplicateEntity(e, preferredGizmo));
    void sdk.operations.dispatch();
  };

  return (
    <>
      <Item
        hidden={!canDuplicate(entity)}
        itemID="duplicate"
        id="duplicate"
        onClick={handleAction(handleDuplicate)}
      >
        <DuplicateIcon /> Duplicate
      </Item>
      <Item
        hidden={!canRemove(entity)}
        itemID="delete"
        id="delete"
        onClick={handleAction(handleRemove)}
      >
        <DeleteIcon /> Delete
      </Item>
      {extra}
    </>
  );
}

export default function CanvasContextMenu({ entity }: { entity: Entity | null }) {
  const [isVisible, setIsVisible] = useState(false);

  const hideOnOutsideInteraction = useCallback(
    (e: MouseEvent) => {
      if (!isVisible) return;
      if (e.type === 'mousemove' && e.buttons === 0) return;
      const target = e.target as HTMLElement;
      if (!target.classList.value.includes('contexify')) {
        contextMenu.hideAll();
      }
    },
    [isVisible],
  );

  useEffect(() => {
    document.addEventListener('mousedown', hideOnOutsideInteraction);
    document.addEventListener('mousemove', hideOnOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', hideOnOutsideInteraction);
      document.removeEventListener('mousemove', hideOnOutsideInteraction);
    };
  });

  return (
    <Menu
      id={CANVAS_CONTEXT_MENU_ID}
      onVisibilityChange={setIsVisible}
      animation={{ enter: 'fade', exit: false }}
    >
      {entity !== null && (
        <>
          <EntityHeader entity={entity} />
          <Separator />
          <CanvasContextMenuItems entity={entity} />
        </>
      )}
    </Menu>
  );
}
