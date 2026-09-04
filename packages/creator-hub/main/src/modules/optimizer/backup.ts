import fs from 'node:fs/promises';
import path from 'node:path';

// Reversibility layer, borrowing Genesis-Plaza dedup.cjs's pattern: pristine originals are
// mirrored into a single `.optimize/backup/` dir tracked by a manifest, and that dir is
// excluded from the deploy bundle via a marker-delimited `.dclignore` block that revert can
// strip exactly. The newly created sidecar textures are NOT ignored — they must deploy.

export const OPTIMIZE_DIR = '.optimize';
const BACKUP_SUBDIR = 'backup';
const MANIFEST_NAME = 'manifest.json';
const DCLIGNORE = '.dclignore';
const DCLIGNORE_MARKER = '# --- creator-hub optimize backup (auto-generated, do not edit) ---';
const MANIFEST_VERSION = 1;

export type OptimizeManifest = {
  version: number;
  createdAt: number;
  modifiedGlbs: string[]; // project-relative posix paths of GLBs overwritten in place
  createdFiles: string[]; // project-relative posix paths of sidecar textures written
  // project-relative posix paths of original textures moved into the backup because a
  // sidecar superseded them (absent in manifests written before this field existed)
  removedFiles: string[];
};

const toPosix = (value: string) => value.split(path.sep).join('/');

export function optimizeDir(projectPath: string): string {
  return path.join(projectPath, OPTIMIZE_DIR);
}

function backupDir(projectPath: string): string {
  return path.join(optimizeDir(projectPath), BACKUP_SUBDIR);
}

function manifestPath(projectPath: string): string {
  return path.join(optimizeDir(projectPath), MANIFEST_NAME);
}

export async function readManifest(projectPath: string): Promise<OptimizeManifest | null> {
  try {
    const manifest = JSON.parse(
      await fs.readFile(manifestPath(projectPath), 'utf8'),
    ) as OptimizeManifest;
    return { ...manifest, removedFiles: manifest.removedFiles ?? [] };
  } catch {
    return null;
  }
}

export async function writeManifest(
  projectPath: string,
  manifest: OptimizeManifest,
): Promise<void> {
  await fs.mkdir(optimizeDir(projectPath), { recursive: true });
  await fs.writeFile(manifestPath(projectPath), JSON.stringify(manifest, null, 2), 'utf8');
}

export function createManifest(): OptimizeManifest {
  return {
    version: MANIFEST_VERSION,
    createdAt: Date.now(),
    modifiedGlbs: [],
    createdFiles: [],
    removedFiles: [],
  };
}

export async function hasBackup(projectPath: string): Promise<boolean> {
  return (await readManifest(projectPath)) !== null;
}

// Mirror an original file into the backup dir, once. `relPath` is project-relative posix.
export async function backupFile(projectPath: string, relPath: string): Promise<void> {
  const dest = path.join(backupDir(projectPath), relPath);
  try {
    await fs.access(dest);
    return; // already backed up (idempotent across re-runs before a revert)
  } catch {
    // not yet backed up
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(path.join(projectPath, relPath), dest);
}

// Move a project file into the backup (same relative path), so revert can put it back.
export async function stashFile(projectPath: string, relPath: string): Promise<void> {
  await backupFile(projectPath, relPath);
  await fs.rm(path.join(projectPath, relPath), { force: true });
}

export async function ensureDclignoreBlock(projectPath: string): Promise<void> {
  const file = path.join(projectPath, DCLIGNORE);
  let existing = '';
  try {
    existing = await fs.readFile(file, 'utf8');
  } catch {
    // no .dclignore yet — create one
  }
  if (existing.includes(DCLIGNORE_MARKER)) return;

  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const block = `${prefix}${DCLIGNORE_MARKER}\n${OPTIMIZE_DIR}\n${OPTIMIZE_DIR}/**\n`;
  await fs.writeFile(file, existing + block, 'utf8');
}

export async function stripDclignoreBlock(projectPath: string): Promise<void> {
  const file = path.join(projectPath, DCLIGNORE);
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return;
  }
  const markerIdx = text.indexOf(DCLIGNORE_MARKER);
  if (markerIdx === -1) return;

  // Drop the marker line and the two entries that follow it, trimming a preceding newline.
  let start = markerIdx;
  if (start > 0 && text[start - 1] === '\n') start -= 1;
  const lines = text.slice(markerIdx).split('\n');
  const removed = lines.slice(0, 3).join('\n'); // marker + OPTIMIZE_DIR + OPTIMIZE_DIR/**
  const rest = text.slice(markerIdx + removed.length);
  const cleaned = text.slice(0, start) + rest;

  if (cleaned.trim().length === 0) {
    await fs.rm(file, { force: true });
  } else {
    await fs.writeFile(file, cleaned, 'utf8');
  }
}

// Restore originals from backup, delete created sidecars, strip the .dclignore block, and
// remove the .optimize dir. Returns the count of restored GLBs.
export async function revertFromManifest(
  projectPath: string,
  manifest: OptimizeManifest,
): Promise<number> {
  let restored = 0;
  for (const rel of manifest.modifiedGlbs) {
    const src = path.join(backupDir(projectPath), rel);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    await fs.mkdir(path.dirname(path.join(projectPath, rel)), { recursive: true });
    await fs.copyFile(src, path.join(projectPath, rel));
    restored++;
  }

  for (const rel of manifest.createdFiles) {
    await fs.rm(path.join(projectPath, rel), { force: true });
  }

  for (const rel of manifest.removedFiles ?? []) {
    const src = path.join(backupDir(projectPath), rel);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    await fs.mkdir(path.dirname(path.join(projectPath, rel)), { recursive: true });
    await fs.copyFile(src, path.join(projectPath, rel));
  }

  await stripDclignoreBlock(projectPath);
  await fs.rm(optimizeDir(projectPath), { recursive: true, force: true });
  return restored;
}

export { toPosix };
