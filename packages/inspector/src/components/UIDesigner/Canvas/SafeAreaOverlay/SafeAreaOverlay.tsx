import React from 'react';

import { type DeviceKind, type SafeRect, SAFE_AREAS } from '../../shared/safe-areas';

import { HudIcon } from './hud-icons';

import './SafeAreaOverlay.css';

interface SafeAreaOverlayProps {
  width: number;
  height: number;
  device: DeviceKind;
  /** `hud` outlines the interactable area; `device` outlines only the hardware insets. */
  variant?: 'hud' | 'device';
  /** Draw the reference HUD guides (joystick, buttons). Independent of which area is outlined. */
  showHud?: boolean;
}

/** Outlines a device's safe area and draws its reference HUD. Visual only (pointer-events: none). */
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({
  width,
  height,
  device,
  variant = 'hud',
  showHud = false,
}) => {
  const { screenInsetArea, interactableArea, hud } = SAFE_AREAS[device];
  const area = variant === 'device' ? screenInsetArea : interactableArea;
  const min = Math.min(width, height);
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
      <div
        className="ui-designer-safe-outline"
        style={box(area)}
      />
      {showHud
        ? hud.map(g => {
            const d = g.size * min;
            return (
              <div
                key={g.id}
                className="ui-designer-hud-guide"
                style={{
                  left: g.x * width - d / 2,
                  top: g.y * height - d / 2,
                  width: d,
                  height: d,
                }}
              >
                <HudIcon kind={g.kind} />
              </div>
            );
          })
        : null}
    </div>
  );
};

export default SafeAreaOverlay;
