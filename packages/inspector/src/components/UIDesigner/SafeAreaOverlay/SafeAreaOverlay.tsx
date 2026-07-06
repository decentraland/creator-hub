import React from 'react';

import { safeAreaFor, type DeviceKind } from '../safe-areas';

import './SafeAreaOverlay.css';

interface SafeAreaOverlayProps {
  // Logical (unscaled) size of the screen rect this overlays.
  width: number;
  height: number;
  device: DeviceKind;
}

// Shades the reserved HUD margins and outlines the center safe zone. Purely
// visual — pointer-events: none so it never intercepts canvas interactions.
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({ width, height, device }) => {
  const { margin, label } = safeAreaFor(device);
  const left = margin.left * width;
  const right = margin.right * width;
  const top = margin.top * height;
  const bottom = margin.bottom * height;
  const midH = Math.max(0, height - top - bottom);
  return (
    <div
      className="ui-designer-safe-area"
      style={{ width, height }}
      aria-hidden="true"
    >
      <div
        className="ui-designer-safe-band"
        style={{ left: 0, top: 0, width, height: top }}
      />
      <div
        className="ui-designer-safe-band"
        style={{ left: 0, top: height - bottom, width, height: bottom }}
      />
      <div
        className="ui-designer-safe-band"
        style={{ left: 0, top, width: left, height: midH }}
      />
      <div
        className="ui-designer-safe-band"
        style={{ left: width - right, top, width: right, height: midH }}
      />
      <div
        className="ui-designer-safe-zone"
        style={{ left, top, width: Math.max(0, width - left - right), height: midH }}
      />
      <span
        className="ui-designer-safe-label"
        style={{ left, top }}
      >
        {label}
      </span>
    </div>
  );
};

export default SafeAreaOverlay;
