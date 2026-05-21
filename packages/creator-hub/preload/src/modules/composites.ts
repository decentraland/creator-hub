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

const CUSTOM_DIR = 'custom';
const FOLDER_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

export function sanitizeCompositeFolderName(rawName: string): string {
  return rawName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function createComposite({
  projectPath,
  name,
}: {
  projectPath: string;
  name: string;
}): Promise<CompositeEntry> {
  const folderName = sanitizeCompositeFolderName(name);
  if (!folderName || !FOLDER_NAME_PATTERN.test(folderName)) {
    throw new Error('Invalid composite name');
  }
  const relativeFolder = `${ASSETS_DIR}/${CUSTOM_DIR}/${folderName}`;
  const absoluteFolder = path.join(projectPath, relativeFolder);
  try {
    await fs.access(absoluteFolder);
    throw new Error('A composite with this name already exists');
  } catch (err: any) {
    if (err && err.code !== 'ENOENT') throw err;
  }
  await fs.mkdir(absoluteFolder, { recursive: true });
  const compositeRelative = `${relativeFolder}/composite.json`;
  const compositeAbsolute = path.join(projectPath, compositeRelative);
  const minimal = {
    version: 1,
    components: [
      {
        name: 'core-schema::Name',
        data: {
          '0': { json: { value: name.trim() } },
        },
      },
    ],
  };
  await fs.writeFile(compositeAbsolute, JSON.stringify(minimal, null, 2), 'utf8');
  return {
    relativePath: compositeRelative,
    displayName: folderName,
    isMain: false,
  };
}

function getCompositeFolder(relativePath: string): { folder: string; fileName: string } {
  const idx = relativePath.lastIndexOf('/');
  if (idx < 0) return { folder: '', fileName: relativePath };
  return { folder: relativePath.slice(0, idx), fileName: relativePath.slice(idx + 1) };
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function duplicateComposite({
  projectPath,
  relativePath,
  newName,
}: {
  projectPath: string;
  relativePath: string;
  newName: string;
}): Promise<CompositeEntry> {
  if (relativePath === MAIN_COMPOSITE_RELATIVE) {
    throw new Error('Cannot duplicate the main composite');
  }
  const folderName = sanitizeCompositeFolderName(newName);
  if (!folderName || !FOLDER_NAME_PATTERN.test(folderName)) {
    throw new Error('Invalid composite name');
  }
  const { folder: sourceFolderRel, fileName } = getCompositeFolder(relativePath);
  if (!sourceFolderRel) throw new Error('Composite has no parent folder to duplicate');

  const sourceAbs = path.join(projectPath, sourceFolderRel);
  const destFolderRel = `${ASSETS_DIR}/${CUSTOM_DIR}/${folderName}`;
  const destAbs = path.join(projectPath, destFolderRel);
  try {
    await fs.access(destAbs);
    throw new Error('A composite with this name already exists');
  } catch (err: any) {
    if (err && err.code !== 'ENOENT') throw err;
  }

  await copyDirectory(sourceAbs, destAbs);

  // Strip any data.json from the duplicate so it doesn't share the source's
  // custom-item id (asset catalogs key on data.json id).
  try {
    await fs.rm(path.join(destAbs, 'data.json'));
  } catch (err: any) {
    if (err && err.code !== 'ENOENT') throw err;
  }

  const newCompositeRelative = `${destFolderRel}/${fileName}`;
  return {
    relativePath: newCompositeRelative,
    displayName: folderName,
    isMain: false,
  };
}
