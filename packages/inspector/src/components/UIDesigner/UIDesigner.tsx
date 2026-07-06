import React from 'react';

import { Box } from '../Box';
import { Canvas } from './Canvas';
import { useUINodeHotkeys } from './useUINodeHotkeys';

import './UIDesigner.css';

const UIDesigner: React.FC = () => {
  // The shared <Box> is a plain function component that does NOT forward refs,
  // so we hang the ref on a real wrapper element (filling the panel) that the
  // hotkeys hook can visibility-check via offsetParent.
  const containerRef = React.useRef<HTMLDivElement>(null);
  useUINodeHotkeys(containerRef);
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    >
      <Box className="ui-designer-canvas-container">
        <Canvas />
      </Box>
    </div>
  );
};

export default React.memo(UIDesigner);
