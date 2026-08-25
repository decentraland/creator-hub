import { useLayoutEffect, useRef } from 'react';

import { getConfig } from '../lib/logic/config';
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
 * Gated on a DEFINED `uiDesignerOpen`, not merely a non-null `uiState`:
 * `useInspectorUIState` surfaces its default (with `uiDesignerOpen` undefined) the
 * instant the sdk exists, before the CRDT stream hydrates the RootEntity.
 * Latching on that would lock in the 3D default and ignore a persisted 2D. A
 * defined value is the signal the real component arrived; a scene that never
 * chose a mode keeps it undefined and correctly stays in the 3D default.
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
    if (restored.current) return;
    if (!uiState || uiState.uiDesignerOpen === undefined) return;
    restored.current = true;
    const open = uiState.uiDesignerOpen && getConfig().uiEditorEnabled;
    if (open === isUIDesigner) return;
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: open }));
  }, [uiState, isUIDesigner, dispatch]);
}
