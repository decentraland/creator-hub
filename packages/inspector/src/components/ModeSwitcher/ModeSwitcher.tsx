import React, { useCallback, useLayoutEffect, useRef } from 'react';
import cx from 'classnames';

import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getHiddenPanels, togglePanel } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';

import './ModeSwitcher.css';

const ModeSwitcherComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const [uiState, updateUIState] = useInspectorUIState();

  // Not localStorage: the iframe's origin port changes each app launch, so it
  // starts empty every session (lib/renderer/controller.ts).
  // The latch is load-bearing — `updateUIState` round-trips back into `uiState`,
  // so without it this effect would re-fire and fight every user toggle.
  // Layout, not passive: a passive effect commits the toggle after the browser has
  // already painted the default (3D), which reads as a visible mode switch.
  // Neither tab is active until the persisted mode lands, so the switch never
  // advertises a selection the restore is about to move.
  const resolved = uiState !== null;
  const is2D = resolved && isUIDesigner;
  const is3D = resolved && !isUIDesigner;

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!uiState || restored.current) return;
    restored.current = true;
    const open = !!uiState.uiDesignerOpen;
    if (open === isUIDesigner) return;
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: open }));
  }, [uiState, isUIDesigner, dispatch]);

  const handleSelect2D = useCallback(() => {
    if (!isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: true }));
    }
    updateUIState({ uiDesignerOpen: true });
  }, [dispatch, isUIDesigner, updateUIState]);

  const handleSelect3D = useCallback(() => {
    if (isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    }
    updateUIState({ uiDesignerOpen: false });
  }, [dispatch, isUIDesigner, updateUIState]);

  return (
    <div
      className="ModeSwitcher"
      role="tablist"
      aria-label="Editor mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={is2D}
        className={cx('ModeSwitcher-tab', { active: is2D })}
        onClick={handleSelect2D}
        title="Edit UI"
      >
        2D
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={is3D}
        className={cx('ModeSwitcher-tab', { active: is3D })}
        onClick={handleSelect3D}
        title="Edit scene"
      >
        3D
      </button>
    </div>
  );
};

export const ModeSwitcher = React.memo(ModeSwitcherComponent);
export default ModeSwitcher;
