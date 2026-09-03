import { useLayoutEffect, useRef } from 'react';

import { getConfig } from '../lib/logic/config';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { getHiddenPanels, togglePanel } from '../redux/ui';
import { PanelName } from '../redux/ui/types';

/** Replays the scene's persisted 2D/3D mode (seeded by the host from `.editor/project.json`) into redux, once, on load. */
export function useRestorePersistedMode(): void {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const config = getConfig();
    const open = config.uiDesignerOpen && config.uiEditorEnabled;
    if (open === isUIDesigner) return;
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: open }));
  }, [dispatch, isUIDesigner]);
}
