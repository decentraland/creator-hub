import React, { useCallback, useState } from 'react';
import { BsCaretDown } from 'react-icons/bs';
import { BiCheckbox, BiCheckboxChecked } from 'react-icons/bi';
import cx from 'classnames';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  getUIDesignerSnapEnabled,
  getUIDesignerTool,
  setUIDesignerSnap,
  setUIDesignerTool,
} from '../../../redux/ui';
import { UIDesignerTool } from '../../../redux/ui/types';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import { ToolbarButton } from '../../Toolbar/ToolbarButton';

import '../../Toolbar/Gizmos/Gizmos.css';

export const Tools = () => {
  const dispatch = useAppDispatch();
  const tool = useAppSelector(getUIDesignerTool);
  const snapEnabled = useAppSelector(getUIDesignerSnapEnabled);
  const [showPanel, setShowPanel] = useState(false);

  const ref = useOutsideClick(useCallback(() => setShowPanel(false), []));
  const handleTogglePanel = useCallback(() => setShowPanel(v => !v), []);
  const select = useCallback(
    (t: UIDesignerTool) => dispatch(setUIDesignerTool({ tool: t })),
    [dispatch],
  );
  const handleToggleSnap = useCallback(
    () => dispatch(setUIDesignerSnap({ enabled: !snapEnabled })),
    [dispatch, snapEnabled],
  );

  const SnapIcon = snapEnabled ? BiCheckboxChecked : BiCheckbox;

  return (
    <div
      className="Gizmos"
      ref={ref}
    >
      <ToolbarButton
        className={cx('gizmo free', { active: tool === UIDesignerTool.FREE })}
        onClick={() => select(UIDesignerTool.FREE)}
        title="Free — move and resize"
      />
      <ToolbarButton
        className={cx('gizmo position', { active: tool === UIDesignerTool.MOVE })}
        onClick={() => select(UIDesignerTool.MOVE)}
        title="Move"
      />
      <ToolbarButton
        className="gizmo rotation"
        disabled
        title="Rotation is not available for UI layouts"
      />
      <ToolbarButton
        className={cx('gizmo scale', { active: tool === UIDesignerTool.RESIZE })}
        onClick={() => select(UIDesignerTool.RESIZE)}
        title="Resize"
      />
      <BsCaretDown
        className="open-panel"
        onClick={handleTogglePanel}
      />
      <div className={cx('panel', { visible: showPanel })}>
        <div className="title">
          <label>Snap</label>
          <SnapIcon
            className="icon"
            onClick={handleToggleSnap}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Tools);
