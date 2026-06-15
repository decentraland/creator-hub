import React, { useCallback, useMemo } from 'react';
import {
  IoCaretDownOutline,
  IoCreateOutline,
  IoEllipseOutline,
  IoSquareOutline,
  IoTextOutline,
} from 'react-icons/io5';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getExpanded,
  getSelectedNode,
  getSelectedRoot,
  selectNode,
  setExpanded,
} from '../../redux/ui-designer';
import { Tree } from '../Tree';
import type { DropType } from '../Tree/utils';
import { useUINodeTree } from './useUINodeTree';
import type { UINode, UINodeType } from './tree-model';

import './NodeTree.css';

// Distinct from `UI_DESIGNER_DND_TYPE` (palette + canvas) and `'ui-roots'`
// (RootsList). The generic Tree<T> dispatches `{ items: T[], context }`
// payloads which are not compatible with `UIDesignerDragItem`, so we keep
// the tree's DnD bus separate from the palette/canvas bus. Cross-surface
// reparent (canvas ↔ tree) is documented as V2 in learnings/phase-8.md.
const NODE_TREE_DND_TYPE = 'ui-designer-tree';

const TYPE_ICONS: Record<UINodeType, JSX.Element> = {
  UiEntity: <IoSquareOutline />,
  Label: <IoTextOutline />,
  Button: <IoEllipseOutline />,
  Input: <IoCreateOutline />,
  Dropdown: <IoCaretDownOutline />,
};

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

const NodeTreeImpl: React.FC = () => {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const expanded = useAppSelector(getExpanded);
  const selectedNode = useAppSelector(getSelectedNode);
  const selectedRoot = useAppSelector(getSelectedRoot);

  // Memoise the Tree<UINode> component once per mount — Tree<T>() returns a
  // memoised component factory; constructing it in render would defeat memo.
  const NodeTreeComponent = useMemo(() => Tree<UINode>(), []);

  const getId = useCallback((n: UINode) => String(n.entity), []);
  const getChildren = useCallback((n: UINode) => n.children, []);
  const getLabel = useCallback((n: UINode) => n.name || `${n.type} ${String(n.entity)}`, []);
  const getIcon = useCallback((n: UINode) => TYPE_ICONS[n.type], []);
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

  const handleRemove = useCallback(
    (node: UINode) => {
      if (!sdk) return;
      const removed = sdk.operations.removeUINode(node.entity);
      void sdk.operations.dispatch();
      // If the deleted subtree held the selection, fall back to the parent (or root).
      if (selectedNode !== null && removed.has(selectedNode as Entity)) {
        const parent = tree ? findParent(tree, node) : null;
        dispatch(selectNode({ node: parent?.entity ?? selectedRoot }));
      }
    },
    [sdk, tree, selectedNode, selectedRoot, dispatch],
  );

  const handleDuplicate = useCallback(
    async (node: UINode) => {
      if (!sdk) return;
      const clone = sdk.operations.duplicateUINode(node.entity);
      await sdk.operations.dispatch();
      dispatch(selectNode({ node: clone }));
    },
    [sdk, dispatch],
  );

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
