import React from 'react';

import { Box } from '../Box';
import { Canvas } from './Canvas';
import { useCodeState } from './code/store';
import { useUINodeHotkeys } from './useUINodeHotkeys';

import './UIDesigner.css';

// Code-mode only: the canvas is a live view over the scene's real .tsx files.
// Edit them in your code editor (VSCode / vim / Notepad) or on the canvas —
// both write to the scene folder; the disk watcher reflects external edits back
// onto the canvas. (The in-app Monaco editor is intentionally not mounted here.)
const UIDesigner: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { filename } = useCodeState();
  useUINodeHotkeys(containerRef);
  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0 }}
    >
      <div
        style={{
          padding: '4px 10px',
          fontSize: 11,
          color: '#8a8a92',
          borderBottom: '1px solid #2a2a2e',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {filename ? (
          <>
            Editing <code>{filename}</code> — edit on the canvas or in your code editor
          </>
        ) : (
          'No UI root selected'
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Box className="ui-designer-canvas-container">
          <Canvas />
        </Box>
      </div>
    </div>
  );
};

export default React.memo(UIDesigner);
