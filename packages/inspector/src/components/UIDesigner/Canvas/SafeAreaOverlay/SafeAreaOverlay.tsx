import React from 'react';
import cx from 'classnames';

import { type DeviceKind, type SafeRect, SAFE_AREAS } from '../../shared/safe-areas';

import './SafeAreaOverlay.css';

interface SafeAreaOverlayProps {
  // Logical (unscaled) size of the screen rect this overlays.
  width: number;
  height: number;
  device: DeviceKind;
}

// Shades the reserved HUD regions and outlines the center safe zone. Purely
// visual — pointer-events: none so it never intercepts canvas interactions.
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({ width, height, device }) => {
  const { regions, safeZone, label } = SAFE_AREAS[device];
  const box = (rect: SafeRect) => ({
    left: rect.x[0] * width,
    top: rect.y[0] * height,
    width: (rect.x[1] - rect.x[0]) * width,
    height: (rect.y[1] - rect.y[0]) * height,
  });
  return (
    <div
      className="ui-designer-safe-area"
      style={{ width, height }}
      aria-hidden="true"
    >
      {regions.map(region => (
        <div
          key={`${region.label}-${region.x[0]}-${region.y[0]}`}
          className={cx('ui-designer-safe-band', region.severity)}
          style={box(region)}
        >
          <span className="ui-designer-safe-band-label">{region.label}</span>
        </div>
      ))}
      <div
        className="ui-designer-safe-zone"
        style={box(safeZone)}
      />
      <span
        className="ui-designer-safe-label"
        style={{ left: safeZone.x[0] * width, top: safeZone.y[0] * height }}
      >
        {label}
      </span>
    </div>
  );
};

export default SafeAreaOverlay;
