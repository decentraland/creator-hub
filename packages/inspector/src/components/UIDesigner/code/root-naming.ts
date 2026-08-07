// Pure helpers for turning user input into a valid, unique UI-root component
// name (and therefore its src/ui/<Name>.tsx filename). Kept dependency-free so
// they're trivially unit-testable and reusable by the store.

// Turn arbitrary input into a valid PascalCase component identifier. Strips
// non-alphanumerics, title-cases words, and guarantees a leading letter/_ (a TS
// identifier can't start with a digit). Falls back to "MainUI" when empty.
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

// Ensure `base` is unique among `existing` names by appending the smallest
// numeric suffix that doesn't collide (MainUI, MainUI1, MainUI2, …).
export function uniqueRootName(base: string, existing: readonly string[]): string {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  let i = 1;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}
