export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function transformPropertyToLabel(value: string) {
  return value
    .split(/[_-]/)
    .map(word => capitalize(word))
    .join(' ');
}

export function toPascalCase(value: string, prefix = '_'): string {
  if (!value) return '';

  const cleaned = value.trim().replace(/\.[^.]+$/, '');

  // splits on: spaces, hyphens, underscores, and camelCase boundaries
  const words = cleaned
    .replace(/[^a-zA-Z0-9\s\-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter(word => word.length > 0);

  const pascalCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  // ensure it doesn't start with a number (prepend prefix if it does)
  return /^[0-9]/.test(pascalCase) ? `${prefix}${pascalCase}` : pascalCase;
}
