import type { SceneBuildEvent } from '../../logic/scene-build-events';

/**
 * Hot-reload the engine scene for code changes, and only for those.
 *
 * Every edit in the Bevy editor rebuilds the scene bundle: the data layer autosaves
 * `assets/scene/main.composite` (+ the generated `entity-names.ts`), and the realm's
 * `sdk-commands start` rebuilds `bin/index.js` from it. Those rebuilds must NOT reload
 * the scene — the edit is already live in the engine through the forward bridge, and a
 * reload mid-drag is what #1391 was about. A rebuild triggered by a file saved in an IDE
 * (anything else, typically under `src/`) MUST reload: the running instance predates
 * the code (#1419).
 *
 * The host relays the bundler's own per-cycle events (the trigger files, then "bundle
 * saved"), so the two cases are told apart by the files a cycle names, never by timing.
 * Script inputs are the one edit that needs a reload of its own: the scene runtime
 * resolves them once at start, so `noteScriptEdit()` marks the next bundle as one to
 * reload on. Same-origin writes the inspector makes itself (code mode splicing
 * `src/ui/*.tsx`) are excluded through `isOwnWrite`.
 */

/** Files the editor's autosave writes; a cycle triggered only by these is not a code change. */
const EDITOR_OUTPUT_FILES = ['assets/scene/main.composite', 'assets/scene/entity-names.ts'];

/** Bundle-saved events closer together than this are one reload (a burst of autosaves). */
const QUIET_MS = 300;

export function isEditorOutput(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return EDITOR_OUTPUT_FILES.some(
    output => normalized === output || normalized.endsWith(`/${output}`),
  );
}

export interface BuildReloadBridgeOptions {
  /** Subscribe to the relayed bundler events. Returns the unsubscribe. */
  subscribe: (listener: (event: SceneBuildEvent) => void) => () => void;
  /** Was this trigger file written by the inspector itself? */
  isOwnWrite: (file: string) => boolean;
  /** Reload the engine scene (the Stop/reset path, preserving the run state). */
  reload: () => void;
  /** Test seam. */
  quietMs?: number;
}

export interface BuildReloadBridge {
  /** A Script component was written: the next bundle embeds inputs the runtime must re-read. */
  noteScriptEdit(): void;
  disconnect(): void;
}

export function createBuildReloadBridge(options: BuildReloadBridgeOptions): BuildReloadBridge {
  const { subscribe, isOwnWrite, reload } = options;
  const quietMs = options.quietMs ?? QUIET_MS;

  let triggers: string[] = [];
  let scriptStale = false;
  // A reload was due but a new cycle started first: reload on THAT cycle's bundle instead,
  // so a burst never loads a bundle that is about to be superseded.
  let reloadCarried = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = subscribe(event => {
    if (event.kind === 'rebuild') {
      triggers.push(event.file);
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        reloadCarried = true;
      }
      return;
    }
    const codeChanged = triggers.some(file => !isEditorOutput(file) && !isOwnWrite(file));
    triggers = [];
    if (!codeChanged && !scriptStale && !reloadCarried) return;
    scriptStale = false;
    reloadCarried = false;
    timer = setTimeout(() => {
      timer = null;
      reload();
    }, quietMs);
  });

  return {
    noteScriptEdit: () => {
      scriptStale = true;
    },
    disconnect: () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
