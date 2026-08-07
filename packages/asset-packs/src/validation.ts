// Shared value-parsing / validation helpers used by both the runtime and the
// inspector, kept here so every consumer parses identically (single source of
// truth for the accepted formats and error messages).

type Rgba = { r: number; g: number; b: number; a: number };

// Strict hex -> Color4-shaped { r, g, b, a } in [0..1]. Stored as '#RRGGBB' or
// '#RRGGBBAA'. Rejects any length other than 6/8 hex digits (returns opaque
// black) and falls each channel back to its default (0 for r/g/b, 1 for a) when
// the byte pair is not a valid 2-hex sequence — prevents NaN reaching PB floats.
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

// Defense-in-depth for asset paths: reject path traversal, backslashes, the
// encoded dot ('%2e'/'%2E'), and absolute paths. Empty string is "unset" (valid).
// Returns an error message or null — the single source of the 'Invalid asset
// path' message.
export function validateAssetPath(path: string): string | null {
  if (path === '') return null;
  if (path.includes('..')) return 'Invalid asset path';
  if (path.includes('\\')) return 'Invalid asset path';
  if (path.includes('%2e') || path.includes('%2E')) return 'Invalid asset path';
  if (path.startsWith('/')) return 'Invalid asset path';
  return null;
}
