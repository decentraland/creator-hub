import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';

import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { analytics, Event } from '../../lib/logic/analytics';
import { getConfig } from '../../lib/logic/config';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getHiddenPanels, togglePanel } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';

import './ModeSwitcher.css';

const ModeSwitcherComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const uiEditorEnabled = useMemo(() => getConfig().uiEditorEnabled, []);
  const [uiState, updateUIState] = useInspectorUIState();

  const resolved = uiState !== null;
  const is2D = resolved && isUIDesigner;
  const is3D = resolved && !isUIDesigner;

  const handleSelect2D = useCallback(() => {
    if (!isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: true }));
      analytics.track(Event.OPEN_UI_EDITOR, {});
    }
    updateUIState({ uiDesignerOpen: true });
  }, [dispatch, isUIDesigner, updateUIState]);

  const handleSelect3D = useCallback(() => {
    if (isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    }
    updateUIState({ uiDesignerOpen: false });
  }, [dispatch, isUIDesigner, updateUIState]);

  if (!uiEditorEnabled) return null;

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
