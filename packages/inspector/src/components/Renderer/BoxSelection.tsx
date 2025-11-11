import React from 'react';
import type { BoxSelectionState } from '../../lib/babylon/setup/boxSelection';

import './BoxSelection.css';

interface BoxSelectionProps {
  selectionState: BoxSelectionState;
}

export const BoxSelection: React.FC<BoxSelectionProps> = ({ selectionState }) => {
  // Only show while actively dragging
  if (!selectionState.isActive) {
    return null;
  }

  const minX = Math.min(selectionState.startX, selectionState.currentX);
  const minY = Math.min(selectionState.startY, selectionState.currentY);
  const width = Math.abs(selectionState.currentX - selectionState.startX);
  const height = Math.abs(selectionState.currentY - selectionState.startY);

  // Only render if dragged at least 5 pixels (to avoid showing on simple clicks)
  if (width < 5 && height < 5) {
    return null;
  }

  return (
    <div
      className="BoxSelection"
      style={{
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
};
