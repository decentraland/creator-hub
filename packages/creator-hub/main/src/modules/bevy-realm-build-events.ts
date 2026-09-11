import type { SceneBuildEvent } from '/shared/types/ipc';

/**
 * The two bundler lines `sdk-commands start` prints per rebuild cycle (logic/bundle.ts):
 * one `File <path> changed, rebuilding...` per trigger, then `Bundle saved <output>`.
 * They are the only per-file signal the realm exposes — the `SCENE_UPDATE` WebSocket
 * message carries no filename — and the same lines the standalone bevy-editor parses.
 */
export const BUILD_EVENT_PATTERN = /File .+ changed, rebuilding|Bundle saved/;

const REBUILD_LINE = /File (.+) changed, rebuilding/;
const BUNDLE_SAVED_LINE = /Bundle saved/;

/** Parse one stdout chunk (possibly several lines, ANSI already stripped) into build events. */
export function parseSceneBuildEvents(chunk: string): SceneBuildEvent[] {
  const events: SceneBuildEvent[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    const rebuild = REBUILD_LINE.exec(line);
    if (rebuild) {
      events.push({ kind: 'rebuild', file: rebuild[1].trim() });
    } else if (BUNDLE_SAVED_LINE.test(line)) {
      events.push({ kind: 'bundle-saved' });
    }
  }
  return events;
}
