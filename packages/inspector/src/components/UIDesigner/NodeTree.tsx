import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  IoEyeOutline as VisibleIcon,
  IoEyeOffOutline as InvisibleIcon,
  IoWarningOutline,
} from 'react-icons/io5';
import { MdOutlineLock as LockIcon, MdOutlineLockOpen as UnlockIcon } from 'react-icons/md';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getExpanded,
  getHiddenNodes,
  getLockedNodes,
  getSelectedNode,
  selectNode,
  setExpanded,
  setNodeHidden,
  setNodeLocked,
} from '../../redux/ui-designer';
import { Tree } from '../Tree';
import type { DropType } from '../Tree/utils';
import { useUINodeActions } from './useUINodeActions';
import { useUINodeTree } from './useUINodeTree';
import { WIDGET_ICONS } from './widget-catalog';
import { renameRoot, spliceMove, useCodeState } from './code/store';
import type { CodeUINode } from './code/types';
import type { UINode } from './tree-model';

import './NodeTree.css';

// Distinct from `UI_DESIGNER_DND_TYPE` (the palette + canvas DnD bus). The generic
// Tree<T> dispatches `{ items: T[], context }` payloads which are not compatible
// with `UIDesignerDragItem`, so the tree keeps its own DnD bus separate from the
// palette/canvas one.
const NODE_TREE_DND_TYPE = 'ui-designer-tree';

// Entities on the path from `root` down to (but excluding) `target`. Used to
// auto-expand every ancestor so a selected node is always revealed in the tree.
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

const NodeTreeImpl: React.FC = () => {
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const activeFile = useCodeState().filename;
  const expanded = useAppSelector(getExpanded);
  const selectedNode = useAppSelector(getSelectedNode);
  const hiddenNodes = useAppSelector(getHiddenNodes);
  const lockedNodes = useAppSelector(getLockedNodes);

  // Memoise the Tree<UINode> component once per mount — Tree<T>() returns a
  // memoised component factory; constructing it in render would defeat memo.
  const NodeTreeComponent = useMemo(() => Tree<UINode>(), []);

  // Reveal the selected node in the tree: expand any collapsed ancestors and
  // scroll its row into view. Guarded by a ref so it only fires when the
  // selection itself changes — not when the user manually collapses a branch
  // (which would otherwise immediately re-expand under them).
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
  const getChildren = useCallback((n: UINode) => n.children, []);
  const getLabel = useCallback((n: UINode) => n.name || `${n.type} ${String(n.entity)}`, []);
  const getIcon = useCallback(
    (n: UINode) => ((n as CodeUINode).opaque ? <IoWarningOutline /> : WIDGET_ICONS[n.type]),
    [],
  );
  const isOpen = useCallback(
    (n: UINode) => expanded[n.entity as unknown as number] !== false,
    [expanded],
  );
  const isSelected = useCallback((n: UINode) => n.entity === selectedNode, [selectedNode]);
  const isHidden = useCallback(() => false, []);
  const canAddChild = useCallback(() => false, []);
  const canRename = useCallback((n: UINode) => !!tree && n.entity === tree.entity, [tree]);

  const handleSetOpen = useCallback(
    (n: UINode, open: boolean) => dispatch(setExpanded({ entity: n.entity, expanded: open })),
    [dispatch],
  );

  const handleSelect = useCallback(
    (n: UINode) => dispatch(selectNode({ node: n.entity })),
    [dispatch],
  );

  const handleDrop = useCallback((source: UINode, target: UINode, dropType: DropType) => {
    if (source.entity === target.entity) return;
    // Opaque nodes are read-only internally — never insert a child into one.
    // A component instance (`<Name />`) doesn't render arbitrary children
    // either; reorder relative to it instead.
    if ((target as CodeUINode).opaque && dropType === 'inside') return;
    if ((target as CodeUINode).componentRef && dropType === 'inside') return;
    // Reparent/reorder by moving the element's source (the code equivalent of
    // setUIParent + reorderUISibling). 'inside' → last child of target;
    // 'before'/'after' → relative to the target sibling.
    void spliceMove(source.entity as unknown as number, {
      kind: dropType === 'inside' ? 'into' : dropType,
      targetId: target.entity as unknown as number,
    });
  }, []);

  // Remove / duplicate share the canvas action bar's logic (selection fallback
  // included) via the useUINodeActions hook.
  const { remove, duplicate } = useUINodeActions();
  const handleRemove = useCallback((node: UINode) => remove(node.entity), [remove]);
  const handleDuplicate = useCallback((node: UINode) => duplicate(node.entity), [duplicate]);

  const handleRename = useCallback(
    (node: UINode, label: string) => {
      const next = label.trim();
      if (!next || !tree || node.entity !== tree.entity || !activeFile) return;
      void renameRoot(activeFile, next);
    },
    [tree, activeFile],
  );

  const noop = useCallback(() => undefined, []);

  // Editor-only lock/eye per row (replaces the generic Tree's engine-entity
  // ActionArea, which writes ECS Lock/Hide components — meaningless for code
  // nodes). Hide removes the node from the CANVAS render; lock blocks canvas
  // select/drag/resize and tree drags. Neither touches the code.
  const renderActionArea = useCallback(
    (n: UINode) => {
      const id = n.entity as unknown as number;
      const isLocked = !!lockedNodes[id];
      const isNodeHidden = !!hiddenNodes[id];
      return (
        <div className="action-area">
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
        </div>
      );
    },
    [hiddenNodes, lockedNodes, dispatch],
  );

  const canDrag = useCallback(
    (n: UINode) => !lockedNodes[n.entity as unknown as number],
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
        onDrop={handleDrop}
        onRename={handleRename}
        onAddChild={noop}
        onRemove={handleRemove}
        onDuplicate={handleDuplicate}
        canDrag={canDrag}
        renderActionArea={renderActionArea}
        dndType={NODE_TREE_DND_TYPE}
      />
    </div>
  );
};

export const NodeTree = React.memo(NodeTreeImpl);

export default NodeTree;
