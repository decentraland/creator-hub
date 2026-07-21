// Editor-only safe-area guides: where the Decentraland explorer HUD covers the
// player's screen, so authored UI stays clear of it. Values are fractions of the
// screen (0..1) per edge; the remainder is the "center safe zone".
export type DeviceKind = 'desktop' | 'mobile';

export interface SafeAreaSpec {
  margin: { left: number; right: number; top: number; bottom: number };
  label: string;
}

// Mobile device reference resolution (landscape) — the device-frame preview size.
export const MOBILE_REFERENCE = { width: 1600, height: 720 };
