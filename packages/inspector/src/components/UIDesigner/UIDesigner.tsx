import React from 'react';

import { Box } from '../Box';
import { Canvas } from './Canvas';
import { CodeEditorPanel } from './code/CodeEditorPanel';
import { UI_DESIGNER_CODE_MODE } from './code/config';
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
      {UI_DESIGNER_CODE_MODE ? (
        // Code-mode: canvas + live .tsx editor side by side, both views over
        // the same source buffer (the store).
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
            <Box className="ui-designer-canvas-container">
              <Canvas />
            </Box>
          </div>
          <div style={{ flex: 1, minWidth: 0, height: '100%', borderLeft: '1px solid #2a2a2e' }}>
            <CodeEditorPanel />
          </div>
        </div>
      ) : (
        <Box className="ui-designer-canvas-container">
          <Canvas />
        </Box>
      )}
    </div>
  );
};

export default React.memo(UIDesigner);
