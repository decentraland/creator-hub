import React, { useState } from 'react';

import { Box } from '../Box';
import { PropertyPanel } from './PropertyPanel';
import { CodeVariablesPanel } from './code/CodeVariablesPanel';
import { CodePropsPanel } from './code/CodePropsPanel';
import { CodeCallbacksPanel } from './code/CodeCallbacksPanel';

import './UIDesigner.css';

type RightTab = 'properties' | 'variables';

// Right rail as tabs: Properties (per-node) and Variables (per-root). The
// Variables tab is the code-mode manager for the active root's logic surface —
// its typed `state` object (CodeVariablesPanel), the props it exposes when nested
// (CodePropsPanel), and its /** @ui-action */ event handlers (CodeCallbacksPanel).
// The classic asset-packs UIBindings panel is unused in code-as-source.
const UIDesignerRightRail: React.FC = () => {
  const [tab, setTab] = useState<RightTab>('properties');
  return (
    <Box className="ui-designer-right-rail">
      <div
        className="ui-designer-right-rail-tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'properties'}
          className={`ui-designer-right-rail-tab${tab === 'properties' ? ' active' : ''}`}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'variables'}
          className={`ui-designer-right-rail-tab${tab === 'variables' ? ' active' : ''}`}
          onClick={() => setTab('variables')}
        >
          Variables
        </button>
      </div>
      <div className="ui-designer-right-rail-tabpanel">
        {tab === 'properties' ? (
          <PropertyPanel />
        ) : (
          <>
            <CodeVariablesPanel />
            <CodePropsPanel />
            <CodeCallbacksPanel />
          </>
        )}
      </div>
    </Box>
  );
};

export default React.memo(UIDesignerRightRail);
export { UIDesignerRightRail };
