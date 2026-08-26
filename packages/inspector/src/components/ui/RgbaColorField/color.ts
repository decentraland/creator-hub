import { parseHexColor } from '@dcl/asset-packs';

export type Color4 = { r: number; g: number; b: number; a?: number };
export type Rgba = { r: number; g: number; b: number; a: number };

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

/** Formats a Color4 as '#rrggbb' — the RGB triplet only, no alpha. */
export function color4ToRgbHex(c: Color4): string {
  const { r, g, b } = color4ToRgba(c);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** Parses a hex string to Color4 via the shared strict codec in @dcl/asset-packs. */
export function hexToColor4(hex: string): Color4 {
  return parseHexColor(hex);
}
