// Coerce a resolved variable value (or any runtime value) to a display string
// for embedding in a mixed-content text field. Driven by the value's runtime
// shape rather than the declared VariableType, so it works wherever a resolved
// value lands: mixed segments, single-field bindings, and static fallbacks.
//
// Rules (V1):
//   string           -> as-is
//   number           -> String(n); non-finite -> ''
//   boolean          -> 'true' / 'false'
//   array            -> elements coerced and joined with ', '
//   color {r,g,b}    -> lowercase '#rrggbb' (channels in [0..1]; ALPHA DROPPED)
//   null / undefined -> ''
//   anything else    -> String(value)
export function coerceToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.map(coerceToString).join(', ');
  if (typeof value === 'object') {
    const c = value as { r?: unknown; g?: unknown; b?: unknown };
    if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
      const toHex = (n: number): string =>
        Math.max(0, Math.min(255, Math.round(n * 255)))
          .toString(16)
          .padStart(2, '0');
      return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    }
  }
  return String(value);
}
