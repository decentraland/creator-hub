import { useCallback, useEffect, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { useChange } from '../../hooks/sdk/useChange';
import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppSelector } from '../../redux/hooks';
import { getSelectedRoot } from '../../redux/ui-designer';
import { debounce } from '../../lib/utils/debounce';
import { buildUINodeTree, type UINode } from './tree-model';

export function useUINodeTree(): UINode | null {
  const sdk = useSdk();
  const root = useAppSelector(getSelectedRoot);

  // A monotonic counter we bump whenever the engine reports a change.
  // Used purely to trigger a re-render so the walker reads fresh state.
  // We deliberately do NOT cache the walker output in useState — caching led
  // to a stale-closure bounce where a transient `root=null` render committed
  // a stale `null` tree that never recovered.
  const [, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick(t => (t + 1) & 0x7fffffff), []);
  const debouncedBump = useCallback(debounce(bumpTick, 10), [bumpTick]);
  useChange(debouncedBump, []);

  // Self-heal legacy roots that were saved with a non-canonical UiTransform
  // (e.g. absolute / fixed 1920px before "root is the screen"). Fires once per
  // root selection; the op no-ops (and we skip dispatch) when already canonical.
  useEffect(() => {
    if (!sdk || root === null) return;
    const repaired = sdk.operations.repairUIRoot(root as Entity);
    if (repaired) void sdk.operations.dispatch();
  }, [sdk, root]);

  if (!sdk || root === null) return null;
  return buildUINodeTree(sdk.engine, root as Entity);
}
