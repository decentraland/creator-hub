import { useLayoutEffect, useRef } from 'react';

import { getConfig } from '../lib/logic/config';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { getHiddenPanels, togglePanel } from '../redux/ui';
import { PanelName } from '../redux/ui/types';
import { useInspectorUIState } from './sdk/useInspectorUIState';

/** Replays the scene's persisted 2D/3D mode into redux, once, on load. */
export function useRestorePersistedMode(): void {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const [uiState] = useInspectorUIState();

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current) return;
    if (!uiState || uiState.uiDesignerOpen === undefined) return;
    restored.current = true;
    const open = uiState.uiDesignerOpen && getConfig().uiEditorEnabled;
    if (open === isUIDesigner) return;
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: open }));
  }, [uiState, isUIDesigner, dispatch]);
}
