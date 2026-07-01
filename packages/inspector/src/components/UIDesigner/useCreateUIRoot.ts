import { useCallback } from 'react';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch } from '../../redux/hooks';
import { selectRoot } from '../../redux/ui-designer';

// Create a new UI root, flush the engine, and select it. Shared by RootsList
// ("+ New UI") and the canvas empty-state CTA so both go through the exact same
// create flow. The dispatch is awaited so the tree re-derives against the
// flushed entity (see RootsList for the original rationale).
export function useCreateUIRoot(): () => Promise<void> {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  return useCallback(async () => {
    if (!sdk) return;
    const entity = sdk.operations.createUIRoot('Untitled UI');
    await sdk.operations.dispatch();
    dispatch(selectRoot({ root: entity }));
  }, [sdk, dispatch]);
}

export default useCreateUIRoot;
