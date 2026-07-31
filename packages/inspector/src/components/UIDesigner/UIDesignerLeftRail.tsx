import React, { useRef, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { useAppSelector } from '../../redux/hooks';
import { getSelectedNode } from '../../redux/ui-designer';
import { Box } from '../Box';
import Search from '../Search';
import { NodeTree } from './NodeTree';
import { WidgetPicker } from './WidgetPicker';
import { CodeRootsList } from './code/CodeRootsList';

import './UIDesigner.css';

const UIDesignerLeftRail: React.FC = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // New nodes are added under the current node (selecting a GUI selects its
  // root node). Disabled until there's a UI to add into.
  const parent = useAppSelector(getSelectedNode);

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
        <div className="ui-designer-rail-search">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="Search nodes"
            onCancel={() => setSearch('')}
          />
        </div>
        <NodeTree filter={search} />
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
