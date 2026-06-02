import React from 'react';

import { Box } from '../Box';
import { NodeTree } from './NodeTree';
import { RootsList } from './RootsList';

import './UIDesigner.css';

const UIDesignerLeftRail: React.FC = () => (
  <Box className="ui-designer-left-rail">
    <div className="ui-designer-rail-section">
      <div className="ui-designer-rail-header">UI Roots</div>
      <RootsList />
    </div>
    <div className="ui-designer-rail-section ui-designer-rail-section-grow">
      <div className="ui-designer-rail-header">Nodes</div>
      <NodeTree />
    </div>
  </Box>
);

export default React.memo(UIDesignerLeftRail);
export { UIDesignerLeftRail };
