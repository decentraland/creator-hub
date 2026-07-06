// Editor-only safe-area guides: where the Decentraland explorer HUD covers the
// player's screen, so authored UI stays clear of it. Values are fractions of the
// screen (0..1) per edge; the remainder is the "center safe zone".
export type DeviceKind = 'desktop' | 'mobile';

export interface SafeAreaSpec {
  margin: { left: number; right: number; top: number; bottom: number };
  label: string;
}

// Mobile — OFFICIAL values (docs.decentraland.org building-for-mobile/safe-area,
// 1600×720 landscape reference): left 30% chat/joystick/emotes, right 25%
// profile/action buttons, top & bottom 8% system bars.
export const MOBILE_SAFE_AREA: SafeAreaSpec = {
  margin: { left: 0.3, right: 0.25, top: 0.08, bottom: 0.08 },
  label: 'Mobile safe area',
};

// Desktop — OFFICIAL value (docs.decentraland.org designing-the-experience/
// ux-ui-guide#layout): the default explorer UI (sidebar, minimap, chat) occupies
// the LEFT 25% of the screen; the remaining 75% is the safe zone. No top / right /
// bottom reservations are documented.
export const DESKTOP_SAFE_AREA: SafeAreaSpec = {
  margin: { left: 0.25, right: 0, top: 0, bottom: 0 },
  label: 'Desktop safe area',
};

// Mobile device reference resolution (landscape) — the device-frame preview size.
export const MOBILE_REFERENCE = { width: 1600, height: 720 };

export function safeAreaFor(device: DeviceKind): SafeAreaSpec {
  return device === 'mobile' ? MOBILE_SAFE_AREA : DESKTOP_SAFE_AREA;
}
