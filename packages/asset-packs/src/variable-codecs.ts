// Single validated codec per VariableType, shared by the asset-packs runtime
// renderer (ui-renderer.tsx) and the inspector's Variables editor. Pure module:
// strings, numbers, and plain { r, g, b, a } objects only — no node APIs, no
// vitest imports (unit tests live in the inspector to avoid lib-build types
// leakage). Switch arms use the same lowercase tag values as VariableType.

type Rgba = { r: number; g: number; b: number; a: number };

const COLOR_HEX = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const NUMBER_DEFAULT = /^-?\d+(\.\d+)?$/;

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

// Coerce a stored default-value string into the runtime value for its type.
export function parseVariableDefault(type: string, raw: string): unknown {
  switch (type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return raw === 'true';
    case 'color':
      return parseHexColor(raw);
    case 'string-array':
      return raw.split('\n').filter(Boolean);
    case 'callback':
      return undefined;
    case 'string':
    default:
      return raw;
  }
}

// Validate a default-value string for editing. Returns an error message or null.
// STRING and STRING_ARRAY are free text (always valid) — path validation belongs
// on asset-path fields (see validateAssetPath), not on free-text variables.
export function validateVariableDefault(type: string, raw: string): string | null {
  switch (type) {
    case 'number':
      return NUMBER_DEFAULT.test(raw) ? null : 'Must be a number';
    case 'color': {
      const hex = raw.startsWith('#') ? raw.slice(1) : raw;
      return COLOR_HEX.test(hex) ? null : 'Must be a hex color (e.g. #RRGGBB)';
    }
    case 'boolean':
      return raw === 'true' || raw === 'false' ? null : "Must be 'true' or 'false'";
    case 'string':
    case 'string-array':
    case 'callback':
    default:
      return null;
  }
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
