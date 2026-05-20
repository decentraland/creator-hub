import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';

import type { CompositeEntry } from '/shared/types/composites';

const ASSETS_DIR = 'assets';
const MAIN_COMPOSITE_RELATIVE = 'assets/scene/main.composite';
const GENERIC_NAMES = new Set(['composite.json', 'main.composite']);

export type { CompositeEntry };

function isCompositeFile(name: string): boolean {
  return (
    name.endsWith('.composite') || name === 'composite.json' || name.endsWith('.composite.json')
  );
}

function toDisplayName(relativePath: string): string {
  const parts = relativePath.split('/');
  const fileName = parts[parts.length - 1];
  if (GENERIC_NAMES.has(fileName)) {
    return parts.length >= 2 ? parts[parts.length - 2] : fileName;
  }
  return fileName.replace(/\.composite(\.json)?$/i, '');
}

async function collectComposites(
  projectPath: string,
  currentRelative: string,
  acc: string[],
): Promise<void> {
  const absDir = path.join(projectPath, currentRelative);
  let entries: Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const rel = currentRelative ? `${currentRelative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await collectComposites(projectPath, rel, acc);
    } else if (entry.isFile() && isCompositeFile(entry.name)) {
      acc.push(rel);
    }
  }
}

async function isValidJsonComposite(absolutePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(absolutePath, 'r');
    try {
      const buffer = Buffer.alloc(64);
      const { bytesRead } = await handle.read(buffer, 0, 64, 0);
      const head = buffer.subarray(0, bytesRead).toString('utf8').trimStart();
      return head.startsWith('{') || head.startsWith('[');
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

export async function listComposites(projectPath: string): Promise<CompositeEntry[]> {
  const found: string[] = [];
  await collectComposites(projectPath, ASSETS_DIR, found);

  const normalized = found.map(p => p.split(path.sep).join('/'));
  const withoutMain = normalized.filter(p => p !== MAIN_COMPOSITE_RELATIVE).sort();

  // Filter out json files whose contents aren't actually JSON (e.g. corrupted
  // composite.json files in asset-packs that contain an XML error page from a
  // failed S3 download). `.composite` binary files are not validated here.
  const validated = await Promise.all(
    withoutMain.map(async rel => {
      if (!rel.endsWith('.json')) return rel;
      const absolute = path.join(projectPath, rel);
      const ok = await isValidJsonComposite(absolute);
      return ok ? rel : null;
    }),
  );

  return [
    { relativePath: MAIN_COMPOSITE_RELATIVE, displayName: 'Main scene', isMain: true },
    ...validated
      .filter((rel): rel is string => rel !== null)
      .map(rel => ({
        relativePath: rel,
        displayName: toDisplayName(rel),
        isMain: false,
      })),
  ];
}

export async function deleteComposite({
  projectPath,
  relativePath,
}: {
  projectPath: string;
  relativePath: string;
}): Promise<void> {
  if (relativePath === MAIN_COMPOSITE_RELATIVE) {
    throw new Error('Cannot delete the main composite');
  }
  const absolute = path.join(projectPath, relativePath);
  if (!absolute.startsWith(path.join(projectPath, ASSETS_DIR))) {
    throw new Error('Composite path is outside the assets directory');
  }
  await fs.rm(absolute);
}
