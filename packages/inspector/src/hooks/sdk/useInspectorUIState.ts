import { useState, useEffect } from 'react';
import type { InspectorUIStateType } from '../../lib/sdk/components/InspectorUIState';
import { useChange } from './useChange';
import { useSdk } from './useSdk';

/**
 * Hook to read and update the InspectorUIState ECS component.
 * This component is stored on the RootEntity and persists UI state across sessions.
 */
export const useInspectorUIState = () => {
  const sdk = useSdk();
  const [uiState, setUiState] = useState<InspectorUIStateType | null>(null);

  useEffect(() => {
    // Initialize state from the component
    if (!sdk) return;
    const { engine, components } = sdk;
    const currentState = components.InspectorUIState.getOrNull(engine.RootEntity);
    setUiState(currentState || {});
  }, [sdk]);

  // Listen for changes to the component
  useChange(
    event => {
      if (!sdk) return;
      const { engine, components } = sdk;

      if (
        event.entity === engine.RootEntity &&
        event.component?.componentId === components.InspectorUIState.componentId
      ) {
        const currentState = components.InspectorUIState.getOrNull(engine.RootEntity);
        setUiState(currentState || {});
      }
    },
    [sdk],
  );

  const updateUIState = (partialState: Partial<InspectorUIStateType>) => {
    if (!sdk) return;
    const { engine, components } = sdk;
    const currentState = components.InspectorUIState.getOrNull(engine.RootEntity) || {};

    components.InspectorUIState.createOrReplace(engine.RootEntity, {
      ...currentState,
      ...partialState,
    });
    sdk.operations.dispatch();
  };

  return [uiState, updateUIState] as const;
};
