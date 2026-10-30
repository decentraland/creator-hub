import path from 'node:path';

import { watch, type FSWatcher } from 'chokidar';
import log from 'electron-log/main';

import { PROJECT_ASSETS_CHANGED_EVENT, type ProjectAssetsChangedEvent } from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';
import { getWindow } from './window';

/**
 * Watches a project's `assets/` tree for files added, changed, or removed on disk from
 * OUTSIDE the editor — e.g. the user drops a `.glb` into the folder from Finder — and
 * nudges the renderer to re-fetch the inspector's asset catalog (#512). In-app imports
 * already go through the storage RPC, so this only closes the filesystem gap the manual
 * "Refresh assets" button used to cover.
 *
 * One watcher per open project path, started when the editor opens a project and stopped
 * when it closes (or on app quit via {@link stopAllProjectWatchers}). The signal is a
 * content-free nudge — the inspector re-lists the catalog itself — so a lost event just
 * means the next change reports again.
 */

// Mirrors the inspector's asset-catalog extension filter
// (packages/inspector/src/lib/data-layer/host/fs-utils.ts `EXTENSIONS`). The catalog only
// lists files under `assets/` whose extension is one of these, so only a change to one of
// them can change what the panel shows. Kept in sync by hand — the two packages share no
// module.
const ASSET_EXTENSIONS = [
  '.glb',
  '.gltf',
  '.png',
  '.jpg',
  '.jpeg',
  '.composite',
  '.composite.bin',
  '.json',
  '.mp3',
  '.ogg',
  '.wav',
  '.mp4',
  '.ts',
  '.tsx',
];

// Directories never worth walking: huge (node_modules) or editor/build output. Skipping
// them at the watcher keeps the watch cheap and, crucially, stops chokidar descending
// node_modules. Matched against path segments RELATIVE to the project root, so a project
// that itself lives under a folder named e.g. `dist` is not self-ignored.
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'bin', 'coverage', '.editor'];

// Collapse a burst of changes (a multi-file drop, or a folder copy) into one refresh.
const DEBOUNCE_MS = 400;

type Watch = { watcher: FSWatcher; timer?: ReturnType<typeof setTimeout> };

const watches: Map<string, Watch> = new Map();

const normalize = (p: string) => p.replace(/\\/g, '/');

/**
 * Would the asset catalog actually list this changed path? It must live under `assets/`,
 * carry a catalog extension, and NOT be state the editor writes itself — the scene graph
 * autosave (`assets/scene/**`, `*.crdt`) and `entity-names.ts`. Without that exclusion the
 * inspector's ~100ms `main.composite` autosave (a `.composite`, which IS a catalog
 * extension) would retrigger the catalog fetch on every edit.
 *
 * Exported for unit testing.
 */
export function isCatalogAsset(root: string, changed: string): boolean {
  const rel = normalize(path.relative(root, changed)).toLowerCase();
  if (rel === '' || rel.startsWith('../') || path.isAbsolute(rel)) return false;
  if (!rel.startsWith('assets/')) return false;
  if (rel.startsWith('assets/scene/')) return false;
  if (rel.endsWith('.crdt') || rel.endsWith('/entity-names.ts') || rel === 'entity-names.ts') {
    return false;
  }
  return ASSET_EXTENSIONS.some(ext => rel.endsWith(ext));
}

export function startProjectWatcher(projectPath: string): void {
  // Idempotent: a StrictMode remount (or a duplicate start) reuses the running watcher
  // instead of stacking a second one on the same tree.
  if (watches.has(projectPath)) return;

  const ignored = (candidate: string) => {
    const rel = normalize(path.relative(projectPath, candidate));
    if (rel === '') return false;
    return rel.split('/').some(seg => IGNORED_DIRS.includes(seg));
  };

  const watcher = watch(projectPath, {
    ignored,
    // React only to changes after we start, not the initial tree walk.
    ignoreInitial: true,
    // A large model copy lands in chunks; wait for the size to settle so we fire once the
    // file is fully written, not mid-copy.
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const entry: Watch = { watcher };
  watches.set(projectPath, entry);

  const onChange = (changed: string) => {
    if (!isCatalogAsset(projectPath, changed)) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      const window = getWindow(MAIN_WINDOW_ID);
      if (!window || window.isDestroyed()) return;
      const payload: ProjectAssetsChangedEvent = { path: projectPath };
      window.webContents.send(PROJECT_ASSETS_CHANGED_EVENT, payload);
    }, DEBOUNCE_MS);
  };

  watcher
    .on('add', onChange)
    .on('change', onChange)
    .on('unlink', onChange)
    .on('error', err => log.warn(`[ProjectWatcher] ${projectPath}:`, err));

  log.info(`[ProjectWatcher] Watching ${projectPath}`);
}

export async function stopProjectWatcher(projectPath: string): Promise<void> {
  const entry = watches.get(projectPath);
  if (!entry) return;
  watches.delete(projectPath);
  if (entry.timer) clearTimeout(entry.timer);
  await entry.watcher.close().catch(() => {});
}

export async function stopAllProjectWatchers(): Promise<void> {
  await Promise.all([...watches.keys()].map(stopProjectWatcher));
}
