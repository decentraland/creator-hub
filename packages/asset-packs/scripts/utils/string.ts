export function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/\s+-\s+/gi, ' ')
    .trim()
    .replace(/\s/gi, '_')
    .replace(/[^a-zA-Z0-9_&-]/gi, '');
}
