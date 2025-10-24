import { useState } from 'react';
import type { InspectorUIStateType } from '../../lib/sdk/components/InspectorUIState';
import { useChange } from './useChange';
import { useSdk } from './useSdk';

/**
 * Hook to read and update the InspectorUIState ECS component.
 * This component is stored on the RootEntity and persists UI state across sessions.
 */
export const useInspectorUIState = () => {
  const [uiState, setUiState] = useState<InspectorUIStateType | null>(null);

  const sdk = useSdk(({ engine, components }) => {
    const currentState = components.InspectorUIState.getOrNull(engine.RootEntity);
    setUiState(currentState || {});
  });

  // Listen for changes to the component
  useChange((event, { engine, components }) => {
    if (
      event.entity === engine.RootEntity &&
      event.component?.componentId === components.InspectorUIState.componentId
    ) {
      const currentState = components.InspectorUIState.getOrNull(engine.RootEntity);
      setUiState(currentState || {});
    }
  });

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
