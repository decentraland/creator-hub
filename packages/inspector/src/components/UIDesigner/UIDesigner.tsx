import React from 'react';

import { Box } from '../Box';
import { Canvas } from './Canvas';
import { useUINodeHotkeys } from './shared/useUINodeHotkeys';

import './UIDesigner.css';

/** Code-mode canvas host: a live view over the scene's real react-ecs .tsx files. */
const UIDesigner: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  useUINodeHotkeys(containerRef);
  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0 }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Box className="ui-designer-canvas-container">
          <Canvas />
        </Box>
      </div>
    </div>
  );
};

export default React.memo(UIDesigner);
