/** Shared value-parsing and validation helpers used by both the runtime and the inspector. */

type Rgba = { r: number; g: number; b: number; a: number };

/** Parse a `#RRGGBB`/`#RRGGBBAA` hex string into Color4-shaped `{ r, g, b, a }` in `[0..1]`; invalid input yields opaque black. */
export function parseHexColor(raw: string): Rgba {
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (hex.length !== 6 && hex.length !== 8) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  const parseChannel = (slice: string, fallback: number): number => {
    const n = parseInt(slice, 16);
    return Number.isFinite(n) ? n / 255 : fallback;
  };
  const r = parseChannel(hex.slice(0, 2), 0);
  const g = parseChannel(hex.slice(2, 4), 0);
  const b = parseChannel(hex.slice(4, 6), 0);
  const a = hex.length === 8 ? parseChannel(hex.slice(6, 8), 1) : 1;
  return { r, g, b, a };
}

/** Reject path traversal, backslashes, encoded dots, and absolute paths; returns an error message or null (empty path is unset/valid). */
export function validateAssetPath(path: string): string | null {
  if (path === '') return null;
  if (path.includes('..')) return 'Invalid asset path';
  if (path.includes('\\')) return 'Invalid asset path';
  if (path.includes('%2e') || path.includes('%2E')) return 'Invalid asset path';
  if (path.startsWith('/')) return 'Invalid asset path';
  return null;
}
