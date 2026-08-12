import { useLayoutEffect, useRef } from 'react';

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { getHiddenPanels, togglePanel } from '../redux/ui';
import { PanelName } from '../redux/ui/types';
import { useInspectorUIState } from './sdk/useInspectorUIState';

/**
 * Replay the scene's persisted 2D/3D mode into redux, once, on load.
 *
 * Not localStorage: the iframe's origin port changes each app launch, so it
 * starts empty every session (lib/renderer/controller.ts). It rides
 * `inspector::UIState` on the scene root instead.
 *
 * The latch is load-bearing — `updateUIState` round-trips back into `uiState`,
 * so without it this would re-fire and fight every user toggle.
 *
 * Layout, not passive: a passive effect commits the toggle after the browser has
 * already painted the default (3D), which reads as a visible mode switch.
 *
 * Lives in App rather than in the ModeSwitcher that reads the same state,
 * because the switcher renders inside the left panel — which the host can hide
 * over the scene RPC (lib/rpc/scene/server.ts). Restoring the persisted mode
 * must not depend on a panel being visible.
 */
export function useRestorePersistedMode(): void {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const [uiState] = useInspectorUIState();

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!uiState || restored.current) return;
    restored.current = true;
    const open = !!uiState.uiDesignerOpen;
    if (open === isUIDesigner) return;
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: open }));
  }, [uiState, isUIDesigner, dispatch]);
}
