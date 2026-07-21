import React, { useRef, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { useAppSelector } from '../../redux/hooks';
import { getSelectedNode, getSelectedRoot } from '../../redux/ui-designer';
import { Box } from '../Box';
import { NodeTree } from './NodeTree';
import { WidgetPicker } from './WidgetPicker';
import { CodeRootsList } from './code/CodeRootsList';

import './UIDesigner.css';

const UIDesignerLeftRail: React.FC = () => {
  const selectedNode = useAppSelector(getSelectedNode);
  const selectedRoot = useAppSelector(getSelectedRoot);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // New nodes are added under the current node (or the root if only the root is
  // selected). Disabled until there's a UI to add into.
  const parent = selectedNode ?? selectedRoot;

  return (
    <Box className="ui-designer-left-rail">
      <div className="ui-designer-rail-section">
        <div className="ui-designer-rail-header">GUIs</div>
        <CodeRootsList />
      </div>
      <div className="ui-designer-rail-section ui-designer-rail-section-grow">
        <div className="ui-designer-rail-header ui-designer-rail-header-row">
          <span>Nodes</span>
          <button
            ref={addBtnRef}
            type="button"
            className="ui-designer-rail-add"
            onClick={() => setPickerOpen(true)}
            disabled={parent === null}
            aria-label="Add widget"
            title="Add widget"
          >
            <IoAddOutline aria-hidden="true" />
          </button>
        </div>
        <NodeTree />
        {pickerOpen && parent !== null ? (
          <WidgetPicker
            parent={parent}
            anchorRef={addBtnRef}
            onDismiss={() => setPickerOpen(false)}
          />
        ) : null}
      </div>
    </Box>
  );
};

export default React.memo(UIDesignerLeftRail);
export { UIDesignerLeftRail };
