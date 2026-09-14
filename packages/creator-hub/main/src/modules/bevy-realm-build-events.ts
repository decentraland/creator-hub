import type { SceneBuildEvent } from '/shared/types/ipc';

/**
 * The two bundler lines `sdk-commands start` prints per rebuild cycle (logic/bundle.ts):
 * one `File <path> changed, rebuilding...` per trigger, then `Bundle saved <output>`.
 * They are the only per-file signal the realm exposes — the `SCENE_UPDATE` WebSocket
 * message carries no filename — and the same lines the standalone bevy-editor parses.
 */
const REBUILD_LINE = /File (.+) changed, rebuilding/;
const BUNDLE_SAVED_LINE = /Bundle saved/;

/** Parse one complete stdout line (ANSI already stripped) into build events. */
export function parseSceneBuildEvents(line: string): SceneBuildEvent[] {
  const rebuild = REBUILD_LINE.exec(line);
  if (rebuild) return [{ kind: 'rebuild', file: rebuild[1].trim() }];
  if (BUNDLE_SAVED_LINE.test(line)) return [{ kind: 'bundle-saved' }];
  return [];
}

/**
 * Reassemble complete lines out of pipe chunks. A chunk boundary can fall anywhere,
 * including inside a build line, so the trailing partial line is held back until the
 * chunk that completes it arrives.
 */
export function createLineBuffer(): { push(chunk: string): string[] } {
  let partial = '';
  return {
    push(chunk) {
      const parts = (partial + chunk).split(/\r?\n/);
      partial = parts.pop() ?? '';
      return parts;
    },
  };
}
