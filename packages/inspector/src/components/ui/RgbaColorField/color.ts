import { parseHexColor } from '@dcl/asset-packs';

export type Color4 = { r: number; g: number; b: number; a?: number };
export type Rgba = { r: number; g: number; b: number; a: number };

// Color4 channels are 0..1; react-colorful RgbaColor is r/g/b 0..255, a 0..1.
export function color4ToRgba(c: Color4): Rgba {
  return {
    r: Math.round((c.r ?? 0) * 255),
    g: Math.round((c.g ?? 0) * 255),
    b: Math.round((c.b ?? 0) * 255),
    a: c.a ?? 1,
  };
}

export function rgbaToColor4(c: Rgba): Color4 {
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255, a: c.a };
}

const hex2 = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

// '#rrggbb' — the RGB triplet only. Alpha is edited as its own 0–100 field, so
// appending it here would show the same value twice.
export function color4ToRgbHex(c: Color4): string {
  const { r, g, b } = color4ToRgba(c);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

// Delegates to the shared strict hex codec in @dcl/asset-packs so the inspector
// and the runtime renderer parse colors identically. The returned { r, g, b, a }
// satisfies the local Color4 type.
export function hexToColor4(hex: string): Color4 {
  return parseHexColor(hex);
}
