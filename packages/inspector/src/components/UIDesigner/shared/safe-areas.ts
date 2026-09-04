/** Editor-only safe-area guides: where the explorer HUD covers the player's screen. */
export type DeviceKind = 'desktop' | 'mobile';

/** A rect in normalized screen coords, `[start, end]` per axis, 0..1. */
export interface SafeRect {
  x: [number, number];
  y: [number, number];
}

/** A reference client HUD control, drawn as a non-interactive guide on the canvas. */
export type HudKind =
  | 'joystick'
  | 'jump'
  | 'keyF'
  | 'keyE'
  | 'emote'
  | 'profile'
  | 'chat'
  | 'counter'
  | 'pointer';

export interface HudGuide {
  id: string;
  kind: HudKind;
  /** Center position in normalized screen coords. */
  x: number;
  y: number;
  /** Diameter as a fraction of the smaller screen dimension. */
  size: number;
}

export interface SafeAreaSpec {
  label: string;
  /** react-ecs `screenInset: 'device'` — hardware insets (notch, island, system bars). */
  screenInsetArea: SafeRect;
  /** react-ecs `screenInset: 'interactable'` — the HUD-safe zone inside the device area. */
  interactableArea: SafeRect;
  /** Reference client HUD controls, shown as guides so authors design around them. */
  hud: HudGuide[];
}

const MOBILE_SAFE_AREA: SafeAreaSpec = {
  label: 'Mobile safe area',
  screenInsetArea: { x: [0.069, 0.931], y: [0.06, 0.94] },
  interactableArea: { x: [0.28, 0.931], y: [0.06, 0.94] },
  hud: [
    { id: 'profile', kind: 'profile', x: 0.05, y: 0.1, size: 0.09 },
    { id: 'chat', kind: 'chat', x: 0.11, y: 0.1, size: 0.07 },
    { id: 'joystick', kind: 'joystick', x: 0.13, y: 0.72, size: 0.22 },
    { id: 'emote', kind: 'emote', x: 0.06, y: 0.88, size: 0.08 },
    { id: 'counter', kind: 'counter', x: 0.9, y: 0.66, size: 0.07 },
    { id: 'keyF', kind: 'keyF', x: 0.955, y: 0.68, size: 0.075 },
    { id: 'keyE', kind: 'keyE', x: 0.87, y: 0.75, size: 0.075 },
    { id: 'jump', kind: 'jump', x: 0.92, y: 0.83, size: 0.15 },
    { id: 'pointer', kind: 'pointer', x: 0.83, y: 0.88, size: 0.075 },
  ],
};

const DESKTOP_SAFE_AREA: SafeAreaSpec = {
  label: 'Desktop safe area',
  screenInsetArea: { x: [0, 1], y: [0, 1] },
  interactableArea: { x: [0.25, 1], y: [0, 1] },
  hud: [],
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
  return inset === 'interactable'
    ? SAFE_AREAS[device].interactableArea
    : SAFE_AREAS[device].screenInsetArea;
}
