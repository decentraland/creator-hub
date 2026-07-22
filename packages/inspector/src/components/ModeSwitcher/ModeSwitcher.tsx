import React, { useCallback } from 'react';
import cx from 'classnames';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getHiddenPanels, togglePanel } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';

import './ModeSwitcher.css';

const ModeSwitcherComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];

  const handleSelect2D = useCallback(() => {
    if (!isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: true }));
    }
  }, [dispatch, isUIDesigner]);

  const handleSelect3D = useCallback(() => {
    if (isUIDesigner) {
      dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    }
  }, [dispatch, isUIDesigner]);

  return (
    <div
      className="ModeSwitcher"
      role="tablist"
      aria-label="Editor mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={isUIDesigner}
        className={cx('ModeSwitcher-tab', { active: isUIDesigner })}
        onClick={handleSelect2D}
        title="Edit UI"
      >
        2D
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!isUIDesigner}
        className={cx('ModeSwitcher-tab', { active: !isUIDesigner })}
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
