import React from 'react';

import { type DeviceKind, type SafeAreaSpec } from '../safe-areas';

import './SafeAreaOverlay.css';

// Mobile — OFFICIAL values (docs.decentraland.org building-for-mobile/safe-area,
// 1600×720 landscape reference): left 30% chat/joystick/emotes, right 25%
// profile/action buttons, top & bottom 8% system bars.
const MOBILE_SAFE_AREA: SafeAreaSpec = {
  margin: { left: 0.3, right: 0.25, top: 0.08, bottom: 0.08 },
  label: 'Mobile safe area',
};

// Desktop — OFFICIAL value (docs.decentraland.org designing-the-experience/
// ux-ui-guide#layout): the default explorer UI (sidebar, minimap, chat) occupies
// the LEFT 25% of the screen; the remaining 75% is the safe zone. No top / right /
// bottom reservations are documented.
const DESKTOP_SAFE_AREA: SafeAreaSpec = {
  margin: { left: 0.25, right: 0, top: 0, bottom: 0 },
  label: 'Desktop safe area',
};

interface SafeAreaOverlayProps {
  // Logical (unscaled) size of the screen rect this overlays.
  width: number;
  height: number;
  device: DeviceKind;
}

// Shades the reserved HUD margins and outlines the center safe zone. Purely
// visual — pointer-events: none so it never intercepts canvas interactions.
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({ width, height, device }) => {
  const { margin, label } = device === 'mobile' ? MOBILE_SAFE_AREA : DESKTOP_SAFE_AREA;
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
