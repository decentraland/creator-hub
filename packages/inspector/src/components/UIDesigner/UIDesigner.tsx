import React from 'react';

import { Box } from '../Box';
import { Canvas } from './Canvas';

import './UIDesigner.css';

const UIDesigner: React.FC = () => (
  <Box className="ui-designer-canvas-container">
    <Canvas />
  </Box>
);

export default React.memo(UIDesigner);
