import React, { useCallback } from 'react';
import { BsArrowsMove } from 'react-icons/bs';
import { MdOpenInFull } from 'react-icons/md';
import cx from 'classnames';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getTool, setTool, type UIDesignerTool } from '../../redux/ui-designer';
import { ToolbarButton } from '../Toolbar/ToolbarButton';

import './UIDesignerTools.css';

const TOOLS: { id: UIDesignerTool; title: string; icon: JSX.Element }[] = [
  { id: 'move', title: 'Move (drag to reposition)', icon: <BsArrowsMove /> },
  { id: 'resize', title: 'Resize (drag handles)', icon: <MdOpenInFull /> },
];

const UIDesignerToolsComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const tool = useAppSelector(getTool);

  const handleSelect = useCallback(
    (next: UIDesignerTool) => () => dispatch(setTool({ tool: next })),
    [dispatch],
  );

  return (
    <div className="ui-designer-tools">
      {TOOLS.map(t => (
        <ToolbarButton
          key={t.id}
          className={cx('ui-designer-tool', t.id, { active: tool === t.id })}
          onClick={handleSelect(t.id)}
          title={t.title}
        >
          {t.icon}
        </ToolbarButton>
      ))}
    </div>
  );
};

export const UIDesignerTools = React.memo(UIDesignerToolsComponent);
export default UIDesignerTools;
