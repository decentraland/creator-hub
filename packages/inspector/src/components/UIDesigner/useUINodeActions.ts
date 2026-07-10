import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getSelectedNode, selectNode } from '../../redux/ui-designer';
import { spliceDuplicate, spliceRemoveNode } from './code/store';

// Shared remove / duplicate actions for a UI node, used by both the NodeTree
// context menu and the canvas selection action bar so the selection-fallback
// behaviour stays identical in both places.
export function useUINodeActions(): {
  remove: (entity: Entity) => void;
  duplicate: (entity: Entity) => Promise<void>;
} {
  const dispatch = useAppDispatch();
  const selectedNode = useAppSelector(getSelectedNode);

  const remove = useCallback(
    (entity: Entity) => {
      void spliceRemoveNode(entity as unknown as number);
      if (selectedNode === entity) dispatch(selectNode({ node: null }));
    },
    [selectedNode, dispatch],
  );

  const duplicate = useCallback(
    async (entity: Entity) => {
      const cloneId = await spliceDuplicate(entity as unknown as number);
      if (cloneId != null) dispatch(selectNode({ node: cloneId as unknown as Entity }));
    },
    [dispatch],
  );

  return { remove, duplicate };
}

export default useUINodeActions;
