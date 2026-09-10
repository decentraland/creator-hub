import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getSelectedNodes, selectNode } from '../../../redux/ui-designer';
import { spliceDuplicate, spliceRemoveNodes } from '../code/store';

/** Shared remove / duplicate actions for a UI node (tree menu, canvas action bar, hotkeys). */
export function useUINodeActions(): {
  remove: (entity: Entity) => void;
  duplicate: (entity: Entity) => Promise<void>;
} {
  const dispatch = useAppDispatch();
  const selectedNodes = useAppSelector(getSelectedNodes);

  const remove = useCallback(
    (entity: Entity) => {
      const batch = selectedNodes.includes(entity) ? selectedNodes : [entity];
      void spliceRemoveNodes(batch.map(e => e as unknown as number));
      if (batch !== selectedNodes) return;
      dispatch(selectNode({ node: null }));
    },
    [selectedNodes, dispatch],
  );

  const duplicate = useCallback(async (entity: Entity) => {
    await spliceDuplicate(entity as unknown as number);
  }, []);

  return { remove, duplicate };
}

export default useUINodeActions;
