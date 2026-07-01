import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getSelectedNode, getSelectedRoot, selectNode } from '../../redux/ui-designer';
import { useUINodeTree } from './useUINodeTree';
import type { UINode } from './tree-model';

function findParentEntity(root: UINode, target: Entity): Entity | null {
  for (const child of root.children) {
    if (child.entity === target) return root.entity;
    const deeper = findParentEntity(child, target);
    if (deeper !== null) return deeper;
  }
  return null;
}

// Shared remove / duplicate actions for a UI node, used by both the NodeTree
// context menu and the canvas selection action bar so the selection-fallback
// behaviour stays identical in both places.
export function useUINodeActions(): {
  remove: (entity: Entity) => void;
  duplicate: (entity: Entity) => Promise<void>;
} {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const selectedNode = useAppSelector(getSelectedNode);
  const selectedRoot = useAppSelector(getSelectedRoot);

  const remove = useCallback(
    (entity: Entity) => {
      if (!sdk) return;
      const removed = sdk.operations.removeUINode(entity);
      void sdk.operations.dispatch();
      // If the deleted subtree held the selection, fall back to the parent (or root).
      if (selectedNode !== null && removed.has(selectedNode)) {
        const parent = tree ? findParentEntity(tree, entity) : null;
        dispatch(selectNode({ node: parent ?? selectedRoot }));
      }
    },
    [sdk, tree, selectedNode, selectedRoot, dispatch],
  );

  const duplicate = useCallback(
    async (entity: Entity) => {
      if (!sdk) return;
      const clone = sdk.operations.duplicateUINode(entity);
      await sdk.operations.dispatch();
      dispatch(selectNode({ node: clone }));
    },
    [sdk, dispatch],
  );

  return { remove, duplicate };
}

export default useUINodeActions;
