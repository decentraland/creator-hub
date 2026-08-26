/** Editor-only safe-area guides: where the explorer HUD covers the player's screen. */
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
  /** A hardware inset (notch, island, system bar) — the `screenInset: 'device'` area. */
  hardware?: boolean;
}

export interface SafeAreaSpec {
  label: string;
  /** Non-overlapping: the bands are translucent, so overlap reads as a region. */
  regions: SafeRegion[];
  safeZone: SafeRect;
  /** Screen minus hardware insets (react-ecs `screenInset: 'device'`). */
  deviceSafeArea: SafeRect;
}

const MOBILE_SAFE_AREA: SafeAreaSpec = {
  label: 'Mobile safe area',
  regions: [
    { label: 'System bar', severity: 'reserved', x: [0, 1], y: [0, 0.08], hardware: true },
    { label: 'System bar', severity: 'reserved', x: [0, 1], y: [0.92, 1], hardware: true },
    { label: 'Chat, joystick, emotes', severity: 'reserved', x: [0, 0.3], y: [0.08, 0.92] },
    { label: 'Profile, camera', severity: 'reserved', x: [0.75, 1], y: [0.08, 0.22] },
    { label: 'Icons only — max 48×48', severity: 'limited', x: [0.75, 1], y: [0.22, 0.5] },
    { label: 'Interaction button', severity: 'reserved', x: [0.75, 1], y: [0.5, 0.92] },
  ],
  safeZone: { x: [0.3, 0.75], y: [0.08, 0.92] },
  deviceSafeArea: { x: [0, 1], y: [0.08, 0.92] },
};

const DESKTOP_SAFE_AREA: SafeAreaSpec = {
  label: 'Desktop safe area',
  regions: [{ label: 'Sidebar, minimap, chat', severity: 'reserved', x: [0, 0.25], y: [0, 1] }],
  safeZone: { x: [0.25, 1], y: [0, 1] },
  deviceSafeArea: { x: [0, 1], y: [0, 1] },
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

/** Preview screens per device — the screen, not the design resolution. */
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

/** The screen rect a react-ecs `screenInset` value maps to, in normalized coords. */
export function insetRect(device: DeviceKind, inset: 'device' | 'interactable' | 'none'): SafeRect {
  if (inset === 'none') return { x: [0, 1], y: [0, 1] };
  return inset === 'interactable' ? SAFE_AREAS[device].safeZone : SAFE_AREAS[device].deviceSafeArea;
}
