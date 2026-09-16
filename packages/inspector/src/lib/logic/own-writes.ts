/**
 * Scene files the inspector itself wrote (code mode splicing `src/ui/*.tsx`, a
 * script created from a template, …). When the bundler later names one of them
 * as a rebuild trigger, that rebuild is the editor's own doing, not a code edit
 * made in an IDE, so the Bevy renderer must not hot-reload for it.
 *
 * A mark is consumed by the first trigger that names it, with a short echo window
 * for the watcher naming one write twice (add + change). Past that, the same file
 * named again is a real edit — a hand edit in an IDE right after a designer write
 * must still hot-reload. A mark the bundler never names expires on its own.
 * Paths are scene-relative on both sides (the host strips the project root) and
 * compared exactly.
 */
const OWN_WRITE_TTL_MS = 10_000;
const ECHO_MS = 1_000;

type Mark = { writtenAt: number; matchedAt: number | null };

const marks = new Map<string, Mark>();

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Record a scene-relative path (e.g. `src/ui/root.tsx`) the inspector is about to write. */
export function markOwnWrite(path: string): void {
  marks.set(normalize(path), { writtenAt: performance.now(), matchedAt: null });
}

/** Is this rebuild trigger (scene-relative, any slash style) the inspector's own recent write? */
export function isOwnWrite(file: string): boolean {
  const key = normalize(file);
  const mark = marks.get(key);
  if (!mark) return false;
  const now = performance.now();
  if (mark.matchedAt === null) {
    if (now - mark.writtenAt >= OWN_WRITE_TTL_MS) {
      marks.delete(key);
      return false;
    }
    mark.matchedAt = now;
    return true;
  }
  if (now - mark.matchedAt < ECHO_MS) return true;
  marks.delete(key);
  return false;
}
