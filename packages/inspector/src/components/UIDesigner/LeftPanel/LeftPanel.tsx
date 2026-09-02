import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { AiOutlineSearch as SearchIcon } from 'react-icons/ai';
import { IoAddOutline } from 'react-icons/io5';
import { VscClose as ClearIcon } from 'react-icons/vsc';

import { analytics, Event } from '../../../lib/logic/analytics';
import { useAppSelector } from '../../../redux/hooks';
import { getSelectedNode } from '../../../redux/ui-designer';
import { Box } from '../../Box';
import { TextField } from '../../ui';
import { createRoot, spliceSetRootChild, useCodeState } from '../code/store';
import { matchesFilter } from '../shared/tree-model';
import { useUINodeTree } from '../shared/useUINodeTree';
import { NodeTree } from './NodeTree';
import { WidgetPicker } from './WidgetPicker';
import { CodeRootsList } from './CodeRootsList';

import '../UIDesigner.css';

function useClickRipple(): [React.ReactNode, () => void] {
  const [click, setClick] = useState(0);
  const fire = useCallback(() => setClick(n => n + 1), []);
  const ripple = click ? (
    <span
      key={click}
      className="ui-designer-rail-add-ripple"
    />
  ) : null;
  return [ripple, fire];
}

const LeftPanel: React.FC = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const addNodeRef = useRef<HTMLButtonElement>(null);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      setSearch('');
    }
  }, []);

  const parent = useAppSelector(getSelectedNode);
  const { roots, filename, emptyRoot } = useCodeState();
  const tree = useUINodeTree();

  const term = search.trim().toLowerCase();
  const showGuis = useMemo(
    () => !term || roots.some(root => root.name.toLowerCase().includes(term)),
    [term, roots],
  );
  const showNodes = !!filename && (!term || (!!tree && matchesFilter(tree, term)));

  const [guiRipple, rippleGui] = useClickRipple();
  const [nodeRipple, rippleNode] = useClickRipple();

  return (
    <Box className="ui-designer-left-rail">
      <div
        className="ui-designer-rail-search"
        onContextMenu={e => e.stopPropagation()}
      >
        <TextField
          placeholder="Search"
          aria-label="Search GUIs and nodes"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          leftIcon={<SearchIcon />}
          rightIcon={
            search ? (
              <ClearIcon
                className="ClearSearch"
                onClick={() => setSearch('')}
              />
            ) : undefined
          }
        />
      </div>
      {showGuis || showNodes ? (
        <PanelGroup
          direction="vertical"
          autoSaveId="ui-designer-rail"
          className="ui-designer-rail-panels"
        >
          {showGuis ? (
            <Panel
              id="guis"
              order={1}
              defaultSize={33}
              minSize={15}
            >
              <div className="ui-designer-rail-section">
                <div className="ui-designer-rail-header ui-designer-rail-header-row">
                  <span>GUIs</span>
                  <button
                    type="button"
                    className="ui-designer-rail-add"
                    onClick={() => {
                      rippleGui();
                      void createRoot();
                      analytics.track(Event.CREATE_UI, {});
                    }}
                    aria-label="New GUI"
                    title="New GUI"
                  >
                    {guiRipple}
                    <IoAddOutline aria-hidden="true" />
                  </button>
                </div>
                <CodeRootsList filter={search} />
              </div>
            </Panel>
          ) : null}
          {showGuis && showNodes ? <PanelResizeHandle className="ui-designer-rail-handle" /> : null}
          {showNodes ? (
            <Panel
              id="nodes"
              order={2}
              defaultSize={67}
              minSize={25}
            >
              <div className="ui-designer-rail-section">
                <div className="ui-designer-rail-header ui-designer-rail-header-row">
                  <span>Nodes</span>
                  <button
                    ref={addNodeRef}
                    type="button"
                    className="ui-designer-rail-add"
                    onClick={() => {
                      rippleNode();
                      setPickerOpen(true);
                    }}
                    disabled={parent === null && !emptyRoot}
                    aria-label="Add widget"
                    title="Add widget"
                  >
                    {nodeRipple}
                    <IoAddOutline aria-hidden="true" />
                  </button>
                </div>
                <NodeTree filter={search} />
                {pickerOpen ? (
                  <WidgetPicker
                    anchorRef={addNodeRef}
                    onDismiss={() => setPickerOpen(false)}
                    {...(parent === null
                      ? { onAdd: (type, preset) => void spliceSetRootChild(type, preset) }
                      : { parent })}
                  />
                ) : null}
              </div>
            </Panel>
          ) : null}
        </PanelGroup>
      ) : null}
    </Box>
  );
};

export default React.memo(LeftPanel);
export { LeftPanel };
