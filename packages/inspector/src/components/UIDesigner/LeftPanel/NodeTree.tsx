import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoEyeOutline as VisibleIcon,
  IoEyeOffOutline as InvisibleIcon,
  IoAddOutline,
  IoDesktopOutline,
  IoPhoneLandscapeOutline,
  IoSwapHorizontalOutline,
  IoWarningOutline,
  IoCubeOutline,
  IoTrashOutline as RemoveIcon,
} from 'react-icons/io5';
import { MdOutlineLock as LockIcon, MdOutlineLockOpen as UnlockIcon } from 'react-icons/md';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  getExpanded,
  getHiddenNodes,
  getLockedNodes,
  getPlatform,
  getSelectedNode,
  getSelectedNodes,
  selectNode,
  selectNodes,
  setExpanded,
  setNodeHidden,
  setNodeLocked,
  setPlatform,
  toggleNodeSelection,
} from '../../../redux/ui-designer';
import { Tree } from '../../Tree';
import type { DropType } from '../../Tree/utils';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from '../shared/dnd';
import { useUINodeActions } from '../shared/useUINodeActions';
import { useUINodeTree } from '../shared/useUINodeTree';
import { WIDGET_ICONS } from '../shared/widget-catalog';
import { addPlatformBranch, spliceAddWidget, spliceMove, spliceRenameNode } from '../code/store';
import { PLATFORMS } from '../code/platform-convention';
import type { CodeUINode } from '../code/types';
import {
  classifyNode,
  matchesFilter,
  nodeLabelText,
  soleComponentRef,
  visibleRange,
  type UINode,
} from '../shared/tree-model';

import './NodeTree.css';

const NODE_TREE_DND_TYPE = 'ui-designer-tree';

const EXTERNAL_DND_TYPES = [UI_DESIGNER_DND_TYPE];

const PLATFORM_ICONS = {
  desktop: <IoDesktopOutline />,
  mobile: <IoPhoneLandscapeOutline />,
};

const PLATFORM_LABELS = { desktop: 'Desktop', mobile: 'Mobile' };

function collectAncestors(root: UINode, target: Entity): Entity[] {
  const path: Entity[] = [];
  const walk = (node: UINode): boolean => {
    if (node.entity === target) return true;
    for (const child of node.children) {
      if (walk(child)) {
        path.push(node.entity);
        return true;
      }
    }
    return false;
  };
  walk(root);
  return path;
}

function isRenameableNode(n: UINode, root: UINode | null | undefined): boolean {
  if (root && n.entity === root.entity) return false;
  const cn = n as CodeUINode;
  return (
    !cn.opaque && !cn.componentRef && !cn.platformVariant && !cn.platform && !soleComponentRef(n)
  );
}

const NodeTreeImpl: React.FC<{ filter?: string }> = ({ filter = '' }) => {
  const term = filter.trim().toLowerCase();
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const expanded = useAppSelector(getExpanded);
  const selectedNode = useAppSelector(getSelectedNode);
  const selectedNodes = useAppSelector(getSelectedNodes);
  const hiddenNodes = useAppSelector(getHiddenNodes);
  const lockedNodes = useAppSelector(getLockedNodes);
  const platform = useAppSelector(getPlatform);

  const NodeTreeComponent = useMemo(() => Tree<UINode>(), []);

  const lastRevealed = useRef<Entity | null>(null);
  useEffect(() => {
    if (!tree || selectedNode === null) return;
    if (lastRevealed.current === selectedNode) return;
    lastRevealed.current = selectedNode;
    for (const ancestor of collectAncestors(tree, selectedNode as Entity)) {
      if (expanded[ancestor as unknown as number] === false) {
        dispatch(setExpanded({ entity: ancestor, expanded: true }));
      }
    }
    requestAnimationFrame(() => {
      document
        .querySelector(`.ui-designer-nodetree [data-test-id="${String(selectedNode)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, [tree, selectedNode, expanded, dispatch]);

  const getId = useCallback((n: UINode) => String(n.entity), []);
  const getChildren = useCallback(
    (n: UINode) => {
      if (soleComponentRef(n)) return [];
      return term ? n.children.filter(c => matchesFilter(c, term)) : n.children;
    },
    [term],
  );
  const getLabel = useCallback(
    (n: UINode) => {
      const ref = soleComponentRef(n);
      if (ref) return ref.componentRef?.name ?? ref.name;
      const cn = n as CodeUINode;
      const label = nodeLabelText(n);
      const branch = cn.platform;
      if (!branch) return label;
      return (
        <span className={cx('ui-designer-tree-branch', { inactive: branch !== platform })}>
          {label}
        </span>
      );
    },
    [platform],
  );
  const getIcon = useCallback((n: UINode) => {
    if (soleComponentRef(n)) return <IoCubeOutline />;
    const cn = n as CodeUINode;
    if (cn.platformVariant) return <IoSwapHorizontalOutline />;
    if (cn.platform) return PLATFORM_ICONS[cn.platform];
    return cn.opaque ? <IoWarningOutline /> : WIDGET_ICONS[classifyNode(n)];
  }, []);
  const isOpen = useCallback(
    (n: UINode) => (term ? true : expanded[n.entity as unknown as number] !== false),
    [expanded, term],
  );
  const isSelected = useCallback((n: UINode) => selectedNodes.includes(n.entity), [selectedNodes]);
  const isHidden = useCallback(() => false, []);
  const canAddChild = useCallback(() => false, []);
  const canRename = useCallback((n: UINode) => isRenameableNode(n, tree), [tree]);

  const handleSetOpen = useCallback(
    (n: UINode, open: boolean) => dispatch(setExpanded({ entity: n.entity, expanded: open })),
    [dispatch],
  );

  const [lastSelected, setLastSelected] = useState<Entity | null>(null);
  const handleLastSelectedChange = useCallback((n: UINode) => setLastSelected(n.entity), []);

  const handleSelect = useCallback(
    (n: UINode, clickType?: 'single' | 'ctrl' | 'shift') => {
      const branch = (n as CodeUINode).platform;
      if (branch && branch !== platform) dispatch(setPlatform({ platform: branch }));
      if (clickType === 'ctrl') {
        dispatch(toggleNodeSelection({ node: n.entity }));
      } else if (clickType === 'shift' && lastSelected !== null && tree) {
        const range = visibleRange(tree, getChildren, isOpen, lastSelected, n.entity);
        if (range.length > 0) dispatch(selectNodes({ nodes: range }));
      } else {
        dispatch(selectNode({ node: n.entity }));
      }
    },
    [dispatch, platform, lastSelected, tree, getChildren, isOpen],
  );

  const handleDrop = useCallback((source: UINode, target: UINode, dropType: DropType) => {
    if (source.entity === target.entity) return;
    if ((target as CodeUINode).opaque && dropType === 'inside') return;
    if ((target as CodeUINode).componentRef && dropType === 'inside') return;
    if ((target as CodeUINode).platform) return;
    if ((target as CodeUINode).platformVariant && dropType === 'inside') return;
    void spliceMove(source.entity as unknown as number, {
      kind: dropType === 'inside' ? 'into' : dropType,
      targetId: target.entity as unknown as number,
    });
  }, []);

  const handleExternalDrop = useCallback(
    (item: unknown, target: UINode, dropType: DropType) => {
      const drag = item as UIDesignerDragItem;
      if (drag.source !== 'palette') return;
      const t = target as CodeUINode;
      const dt: DropType =
        target.entity === tree?.entity && dropType !== 'inside' ? 'inside' : dropType;
      if (dt === 'inside' && (t.opaque || t.componentRef || t.platformVariant)) return;
      if (t.platform) return;
      void spliceAddWidget(target.entity as unknown as number, dt, drag.type, drag.preset);
    },
    [tree],
  );

  const { remove, duplicate } = useUINodeActions();
  const handleRemove = useCallback((node: UINode) => remove(node.entity), [remove]);
  const handleDuplicate = useCallback((node: UINode) => duplicate(node.entity), [duplicate]);

  const handleRename = useCallback((node: UINode, label: string) => {
    const next = label.trim();
    if (next) void spliceRenameNode(node.entity as unknown as number, next);
  }, []);

  const noop = useCallback(() => undefined, []);

  const renderActionArea = useCallback(
    (n: UINode) => {
      const id = n.entity as unknown as number;
      const cn = n as CodeUINode;
      if (cn.platformVariant) {
        const missing = PLATFORMS.filter(p => !cn.children.some(c => c.platform === p));
        if (missing.length === 0) return null;
        return (
          <div className="action-area">
            {missing.map(p => (
              <div
                key={p}
                className="action-button"
                role="button"
                aria-label={`Add ${PLATFORM_LABELS[p]} variant`}
                title={`Add a ${PLATFORM_LABELS[p]} variant`}
                onClick={e => {
                  e.stopPropagation();
                  void addPlatformBranch(id, p);
                }}
              >
                <IoAddOutline />
                {PLATFORM_ICONS[p]}
              </div>
            ))}
          </div>
        );
      }
      const isLocked = !!lockedNodes[id];
      const isNodeHidden = !!hiddenNodes[id];
      return (
        <div className={cx('action-area', { 'is-hidden': isNodeHidden })}>
          <div
            className="action-button"
            role="button"
            aria-label={isLocked ? 'Unlock node' : 'Lock node'}
            onClick={e => {
              e.stopPropagation();
              dispatch(setNodeLocked({ entity: n.entity, locked: !isLocked }));
            }}
          >
            {isLocked ? <LockIcon className="lock-icon" /> : <UnlockIcon className="unlock-icon" />}
          </div>
          <div
            className="action-button"
            role="button"
            aria-label={isNodeHidden ? 'Show node' : 'Hide node'}
            onClick={e => {
              e.stopPropagation();
              dispatch(setNodeHidden({ entity: n.entity, hidden: !isNodeHidden }));
            }}
          >
            {isNodeHidden ? (
              <InvisibleIcon className="invisible-icon" />
            ) : (
              <VisibleIcon className="visible-icon" />
            )}
          </div>
          <div
            className="action-button"
            role="button"
            aria-label={`Delete ${nodeLabelText(n)}`}
            onClick={e => {
              e.stopPropagation();
              handleRemove(n);
            }}
          >
            <RemoveIcon className="remove-icon" />
          </div>
        </div>
      );
    },
    [hiddenNodes, lockedNodes, dispatch, handleRemove],
  );

  const canDrag = useCallback(
    (n: UINode) => !lockedNodes[n.entity as unknown as number] && !(n as CodeUINode).platform,
    [lockedNodes],
  );

  if (!tree) return null;

  return (
    <div className="ui-designer-nodetree">
      <NodeTreeComponent
        value={tree}
        getId={getId}
        getChildren={getChildren}
        getLabel={getLabel}
        getIcon={getIcon}
        isOpen={isOpen}
        isSelected={isSelected}
        isHidden={isHidden}
        canAddChild={canAddChild}
        canRename={canRename}
        onSetOpen={handleSetOpen}
        onSelect={handleSelect}
        onLastSelectedChange={handleLastSelectedChange}
        onDrop={handleDrop}
        onRename={handleRename}
        onAddChild={noop}
        onRemove={handleRemove}
        onDuplicate={handleDuplicate}
        canDrag={canDrag}
        renderActionArea={renderActionArea}
        dndType={NODE_TREE_DND_TYPE}
        externalDndTypes={EXTERNAL_DND_TYPES}
        onExternalDrop={handleExternalDrop}
        allowBeforeDrop
      />
    </div>
  );
};

export const NodeTree = React.memo(NodeTreeImpl);

export default NodeTree;
