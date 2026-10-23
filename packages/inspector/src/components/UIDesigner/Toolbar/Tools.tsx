import React, { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getUIDesignerTool, setUIDesignerTool } from '../../../redux/ui';
import { UIDesignerTool } from '../../../redux/ui/types';
import {
  GizmoMoveIcon,
  GizmoRotateIcon,
  GizmoScaleIcon,
  GizmoSelectIcon,
} from '../../Toolbar/icons';
import { ToolbarButton } from '../../Toolbar/ToolbarButton';

import '../../Toolbar/Gizmos/Gizmos.css';

export const Tools = () => {
  const dispatch = useAppDispatch();
  const tool = useAppSelector(getUIDesignerTool);
  const select = useCallback(
    (t: UIDesignerTool) => dispatch(setUIDesignerTool({ tool: t })),
    [dispatch],
  );

  return (
    <div className="Gizmos">
      <ToolbarButton
        className="gizmo free"
        aria-pressed={tool === UIDesignerTool.FREE}
        onClick={() => select(UIDesignerTool.FREE)}
        title="Free — move and resize"
      >
        <GizmoSelectIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo position"
        aria-pressed={tool === UIDesignerTool.MOVE}
        onClick={() => select(UIDesignerTool.MOVE)}
        title="Move"
      >
        <GizmoMoveIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo rotation"
        disabled
        title="Rotation is not available for UI layouts"
      >
        <GizmoRotateIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo scale"
        aria-pressed={tool === UIDesignerTool.RESIZE}
        onClick={() => select(UIDesignerTool.RESIZE)}
        title="Resize"
      >
        <GizmoScaleIcon />
      </ToolbarButton>
    </div>
  );
};

export default React.memo(Tools);
