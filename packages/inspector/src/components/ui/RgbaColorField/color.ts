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

// '#rrggbb' (a===1) or '#rrggbbaa'.
export function color4ToHex(c: Color4): string {
  const { r, g, b, a } = color4ToRgba(c);
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a >= 1 ? base : `${base}${hex2(a * 255)}`;
}

export function hexToColor4(hex: string): Color4 {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(h.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(h.slice(4, 6), 16) / 255 || 0;
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
