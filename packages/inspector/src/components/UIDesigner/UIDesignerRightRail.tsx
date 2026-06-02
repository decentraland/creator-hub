import React from 'react';

import { Box } from '../Box';
import { PropertyPanel } from './PropertyPanel';
import { VariablesPanel } from './VariablesPanel';

import './UIDesigner.css';

const UIDesignerRightRail: React.FC = () => (
  <Box className="ui-designer-right-rail">
    <div className="ui-designer-right-rail-variables">
      <VariablesPanel />
    </div>
    <div className="ui-designer-right-rail-properties">
      <PropertyPanel />
    </div>
  </Box>
);

export default React.memo(UIDesignerRightRail);
export { UIDesignerRightRail };
