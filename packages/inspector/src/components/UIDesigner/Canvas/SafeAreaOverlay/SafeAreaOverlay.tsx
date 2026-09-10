import React from 'react';
import cx from 'classnames';

import { type DeviceKind, type SafeRect, SAFE_AREAS } from '../../shared/safe-areas';

import './SafeAreaOverlay.css';

interface SafeAreaOverlayProps {
  width: number;
  height: number;
  device: DeviceKind;
  /** `hud` shades HUD regions + safe zone (Gameplay Safe Area); `device` shades only hardware insets. */
  variant?: 'hud' | 'device';
}

/** Shades a device's reserved regions on the canvas. Visual only (pointer-events: none). */
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({
  width,
  height,
  device,
  variant = 'hud',
}) => {
  const { regions, safeZone } = SAFE_AREAS[device];
  const shown = variant === 'device' ? regions.filter(r => r.hardware) : regions;
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
      {shown.map(region => (
        <div
          key={`${region.label}-${region.x[0]}-${region.y[0]}`}
          className={cx('ui-designer-safe-band', region.severity)}
          style={box(region)}
        >
          <span className="ui-designer-safe-band-label">{region.label}</span>
        </div>
      ))}
      {variant === 'hud' ? (
        <div
          className="ui-designer-safe-zone"
          style={box(safeZone)}
        />
      ) : null}
    </div>
  );
};

export default SafeAreaOverlay;
