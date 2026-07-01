import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getExpanded, getSelectedNode, selectNode, setExpanded } from '../../redux/ui-designer';
import { Tree } from '../Tree';
import type { DropType } from '../Tree/utils';
import { useUINodeActions } from './useUINodeActions';
import { useUINodeTree } from './useUINodeTree';
import { WIDGET_ICONS } from './widget-catalog';
import type { UINode } from './tree-model';

import './NodeTree.css';

// Distinct from `UI_DESIGNER_DND_TYPE` (palette + canvas) and `'ui-roots'`
// (RootsList). The generic Tree<T> dispatches `{ items: T[], context }`
// payloads which are not compatible with `UIDesignerDragItem`, so we keep
// the tree's DnD bus separate from the palette/canvas bus. Cross-surface
// reparent (canvas ↔ tree) is documented as V2 in learnings/phase-8.md.
const NODE_TREE_DND_TYPE = 'ui-designer-tree';

// Walk a UINode tree and locate the parent of `target`. Returns null if
// `target` is the root or not found.
function findParent(root: UINode, target: UINode): UINode | null {
  for (const child of root.children) {
    if (child.entity === target.entity) return root;
    const deeper = findParent(child, target);
    if (deeper) return deeper;
  }
  return null;
}

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
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const expanded = useAppSelector(getExpanded);
  const selectedNode = useAppSelector(getSelectedNode);

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
  const getIcon = useCallback((n: UINode) => WIDGET_ICONS[n.type], []);
  const isOpen = useCallback(
    (n: UINode) => expanded[n.entity as unknown as number] !== false,
    [expanded],
  );
  const isSelected = useCallback((n: UINode) => n.entity === selectedNode, [selectedNode]);
  const isHidden = useCallback(() => false, []);
  const canAddChild = useCallback(() => false, []);
  const canRename = useCallback(() => false, []);

  const handleSetOpen = useCallback(
    (n: UINode, open: boolean) => dispatch(setExpanded({ entity: n.entity, expanded: open })),
    [dispatch],
  );

  const handleSelect = useCallback(
    (n: UINode) => dispatch(selectNode({ node: n.entity })),
    [dispatch],
  );

  const handleDrop = useCallback(
    (source: UINode, target: UINode, dropType: DropType) => {
      if (!sdk || !tree) return;
      if (source.entity === target.entity) return;

      if (dropType === 'inside') {
        const ok = sdk.operations.setUIParent(source.entity, target.entity);
        if (ok) void sdk.operations.dispatch();
        return;
      }

      // before / after — reparent under target's parent (if it differs),
      // then reorder via `rightOf`. `Tree<T>.utils.calculateDropType` only
      // emits 'inside' or 'after' today (no 'before'), but we handle both
      // defensively for future-proofing.
      const targetParent = findParent(tree, target);
      if (!targetParent) return; // Dropping next to the root makes no sense.

      const reparentOk = sdk.operations.setUIParent(source.entity, targetParent.entity);
      if (!reparentOk) return;

      if (dropType === 'after') {
        sdk.operations.reorderUISibling(source.entity, target.entity);
      } else {
        // 'before' — place source where target currently is by finding the
        // sibling immediately to target's left.
        const siblings = targetParent.children;
        const idx = siblings.findIndex(c => c.entity === target.entity);
        const leftOfTarget = idx > 0 ? siblings[idx - 1] : undefined;
        sdk.operations.reorderUISibling(source.entity, leftOfTarget?.entity);
      }
      void sdk.operations.dispatch();
    },
    [sdk, tree],
  );

  // Remove / duplicate share the canvas action bar's logic (selection fallback
  // included) via the useUINodeActions hook.
  const { remove, duplicate } = useUINodeActions();
  const handleRemove = useCallback((node: UINode) => remove(node.entity), [remove]);
  const handleDuplicate = useCallback((node: UINode) => duplicate(node.entity), [duplicate]);

  const noop = useCallback(() => undefined, []);

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
        onRename={noop}
        onAddChild={noop}
        onRemove={handleRemove}
        onDuplicate={handleDuplicate}
        dndType={NODE_TREE_DND_TYPE}
      />
    </div>
  );
};

export const NodeTree = React.memo(NodeTreeImpl);

export default NodeTree;
