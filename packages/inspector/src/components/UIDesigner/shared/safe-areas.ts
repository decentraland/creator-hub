// Editor-only safe-area guides: where the Decentraland explorer HUD covers the
// player's screen, so authored UI stays clear of it.
export type DeviceKind = 'desktop' | 'mobile';

/** A rect in normalized screen coords, `[start, end]` per axis, 0..1. */
export interface SafeRect {
  x: [number, number];
  y: [number, number];
}

export interface SafeRegion extends SafeRect {
  label: string;
  /** `reserved` — keep UI out. `limited` — usable, but with a documented caveat. */
  severity: 'reserved' | 'limited';
}

export interface SafeAreaSpec {
  label: string;
  /** Non-overlapping: the bands are translucent, so overlap reads as a region. */
  regions: SafeRegion[];
  safeZone: SafeRect;
}

// Mobile — OFFICIAL values (docs.decentraland.org build-for-mobile/develop/
// safe-area, 1600×720 landscape reference). Modelled as REGIONS, not four edge
// bands: the right 25% is two clusters with a documented gap between them, and a
// solid right band shades that gap as forbidden when the docs explicitly offer it
// for small elements.
const MOBILE_SAFE_AREA: SafeAreaSpec = {
  label: 'Mobile safe area',
  regions: [
    { label: 'System bar', severity: 'reserved', x: [0, 1], y: [0, 0.08] },
    { label: 'System bar', severity: 'reserved', x: [0, 1], y: [0.92, 1] },
    { label: 'Chat, joystick, emotes', severity: 'reserved', x: [0, 0.3], y: [0.08, 0.92] },
    { label: 'Profile, camera', severity: 'reserved', x: [0.75, 1], y: [0.08, 0.22] },
    { label: 'Icons only — max 48×48', severity: 'limited', x: [0.75, 1], y: [0.22, 0.5] },
    { label: 'Interaction button', severity: 'reserved', x: [0.75, 1], y: [0.5, 0.92] },
  ],
  safeZone: { x: [0.3, 0.75], y: [0.08, 0.92] },
};

// Desktop — OFFICIAL value (docs.decentraland.org designing-the-experience/
// ux-ui-guide#layout): the default explorer UI (sidebar, minimap, chat) occupies
// the LEFT 25%; the remaining 75% is the safe zone. ONE region on purpose — the
// docs publish the block, not its contents, and splitting it into invented
// sub-rects would read as precision we don't have.
const DESKTOP_SAFE_AREA: SafeAreaSpec = {
  label: 'Desktop safe area',
  regions: [{ label: 'Sidebar, minimap, chat', severity: 'reserved', x: [0, 0.25], y: [0, 1] }],
  safeZone: { x: [0.25, 1], y: [0, 1] },
};

export const SAFE_AREAS: Record<DeviceKind, SafeAreaSpec> = {
  desktop: DESKTOP_SAFE_AREA,
  mobile: MOBILE_SAFE_AREA,
};

/** A screen the canvas can preview against — the frame the UI is fitted into. */
export interface ScreenSize {
  width: number;
  height: number;
}

export interface ScreenPreset extends ScreenSize {
  id: string;
  label: string;
}

// Preview screens per device. These are the SCREEN, not the design resolution —
// the UI is authored at src/ui/index.tsx's virtualWidth/Height and the explorer
// scales it to fit whatever screen the player has, which is what switching these
// lets you rehearse.
//
// Mobile leads with 1600×720 because that is the reference the published safe
// area is derived at (see MOBILE_SAFE_AREA); the other two are common device
// aspects, there to check the layout holds, not to claim per-device accuracy.
export const SCREEN_PRESETS: Record<DeviceKind, ScreenPreset[]> = {
  desktop: [
    { id: 'desktop-1080p', label: '1920 × 1080 · 16:9', width: 1920, height: 1080 },
    { id: 'desktop-ultrawide', label: '2560 × 1080 · 21:9', width: 2560, height: 1080 },
    { id: 'desktop-laptop', label: '1440 × 900 · 16:10', width: 1440, height: 900 },
  ],
  mobile: [
    { id: 'mobile-reference', label: '1600 × 720 · DCL reference', width: 1600, height: 720 },
    { id: 'mobile-phone', label: '2340 × 1080 · 19.5:9', width: 2340, height: 1080 },
    { id: 'mobile-tablet', label: '2048 × 1536 · 4:3', width: 2048, height: 1536 },
  ],
};

export const DEFAULT_SCREENS: Record<DeviceKind, ScreenSize> = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 1600, height: 720 },
};
