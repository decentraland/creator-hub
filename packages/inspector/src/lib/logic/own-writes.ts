/**
 * Scene files the inspector itself wrote (code mode splicing `src/ui/*.tsx`, a
 * script created from a template, …). When the bundler later names one of them
 * as a rebuild trigger, that rebuild is the editor's own doing, not a code edit
 * made in an IDE, so the Bevy renderer must not hot-reload for it. Matched by
 * path, with a generous window: the bundler names the file within a few hundred
 * milliseconds of the write, and may name it twice (add + change).
 */
const OWN_WRITE_TTL_MS = 10_000;

const writtenAt = new Map<string, number>();

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Record a scene-relative path (e.g. `src/ui/root.tsx`) the inspector is about to write. */
export function markOwnWrite(path: string): void {
  writtenAt.set(normalize(path), performance.now());
}

/**
 * Was `file` (as the bundler printed it — absolute or scene-relative, any slash
 * style) written by the inspector recently?
 */
export function isOwnWrite(file: string): boolean {
  const now = performance.now();
  const candidate = normalize(file);
  for (const [path, at] of writtenAt) {
    if (now - at >= OWN_WRITE_TTL_MS) {
      writtenAt.delete(path);
      continue;
    }
    if (candidate === path || candidate.endsWith(`/${path}`)) return true;
  }
  return false;
}
