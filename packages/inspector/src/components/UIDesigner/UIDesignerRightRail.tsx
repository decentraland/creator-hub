import React, { useState } from 'react';

import { Box } from '../Box';
import { PropertyPanel } from './PropertyPanel';
import { VariablesPanel } from './VariablesPanel';

import './UIDesigner.css';

type RightTab = 'properties' | 'variables';

// Right rail as tabs: Properties (per-node) and Variables (per-root). Splitting
// them frees the full panel height for Properties (the Variables list used to be
// capped at ~35%) and separates the per-node vs per-root scopes.
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
        {tab === 'properties' ? <PropertyPanel /> : <VariablesPanel />}
      </div>
    </Box>
  );
};

export default React.memo(UIDesignerRightRail);
export { UIDesignerRightRail };
