/** Turn arbitrary input into a valid PascalCase component identifier; falls back to "MainUI" when empty. */
export function toComponentName(input: string): string {
  const pascal = (input || '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const safe = pascal.replace(/^[^A-Za-z_]+/, '');
  return safe || 'MainUI';
}

/** Ensure `base` is unique among `existing` by appending the smallest non-colliding numeric suffix. */
export function uniqueName(base: string, existing: readonly string[]): string {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  let i = 1;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}
