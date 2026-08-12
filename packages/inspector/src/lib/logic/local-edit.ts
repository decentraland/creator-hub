/**
 * "The editor itself just changed the scene's files."
 *
 * `sdk-commands start --data-layer` broadcasts a filename-less SCENE_UPDATE on
 * any file change — including the ones the editor causes — so a renderer that
 * hot-reloads on that signal has to tell OUR writes apart from an external save.
 * The only way to do that is for the writers to say so, and there are two of
 * them: CRDT edits (the data layer rewrites main.crdt) and code mode (which
 * writes src/ui/*.tsx straight through the storage bridge, bypassing the data
 * layer entirely). Both feed this one beacon; before it existed only the first
 * did, so every UI Designer edit reloaded the whole Bevy scene.
 *
 * Deliberately a timestamp and not an event: the reader is a debounced
 * suppression window, which needs "how long ago", not "it happened".
 */
let lastEditAt = Number.NEGATIVE_INFINITY;

export function markLocalEdit(): void {
  lastEditAt = performance.now();
}

export function hasRecentLocalEdit(withinMs: number): boolean {
  return performance.now() - lastEditAt < withinMs;
}
