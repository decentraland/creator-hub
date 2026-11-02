import fs from 'fs/promises';
import nodePath from 'path';
import { shell } from 'electron';

import { isInside } from '/shared/paths';

type WriteFileData = Parameters<typeof fs.writeFile>[1];
type WriteFileOptions = Parameters<typeof fs.writeFile>[2];

export async function resolve(...paths: string[]) {
  return nodePath.resolve(...paths);
}

/**
 * Resolves `relativePath` against `base` and returns it only if the result stays inside
 * `base`.
 *
 * @throws if `relativePath` is absolute, resolves outside `base`, or reaches it through a
 * symbolic link that points outside `base` — including a link whose own target does not
 * exist.
 */
export async function resolveWithin(base: string, relativePath: string) {
  if (nodePath.isAbsolute(relativePath)) {
    throw new Error(`Path is not relative: ${relativePath}`);
  }

  const resolvedBase = nodePath.resolve(base);
  const resolved = nodePath.resolve(resolvedBase, relativePath);

  assertInside(resolvedBase, resolved, relativePath);

  const realBase = await realpathOrNull(resolvedBase);
  if (!realBase) {
    // `base` does not exist yet, so there are no links to follow and nothing further to
    // canonicalize against.
    return resolved;
  }

  assertInside(realBase, await realpathOfNearestAncestor(resolved, relativePath), relativePath);

  return resolved;
}

/**
 * Canonical path of `target` if it exists, else of its closest existing ancestor.
 *
 * Canonicalizing the deepest *existing* ancestor rather than `target` is what makes this
 * usable for paths being created: a new file has no `realpath`, but every directory on the
 * way to it does. `nodePath.resolve` has already collapsed any `..`, so a suffix that is
 * genuinely absent cannot climb back out of what this returns.
 *
 * @throws if a component is a symbolic link whose target does not exist. `realpath` reports
 * ENOENT both for that and for a path that is simply absent, so without `lstat` to tell them
 * apart the walk would climb past the link and ignore where it points — while `writeFile`
 * and `mkdir` do follow it. Rejecting is deliberate: such a link cannot be read from anyway,
 * and resolving one to decide whether its target would land inside `base` is more than any
 * scene needs.
 */
async function realpathOfNearestAncestor(target: string, original: string) {
  let current = target;

  for (;;) {
    const real = await realpathOrNull(current);
    if (real) return real;

    if (await isSymbolicLink(current)) {
      throw new Error(`Path is a broken symbolic link: ${original}`);
    }

    const parent = nodePath.dirname(current);
    if (parent === current) return current; // reached the filesystem root
    current = parent;
  }
}

async function isSymbolicLink(path: string) {
  try {
    return (await fs.lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

function assertInside(base: string, resolved: string, original: string) {
  if (!isInside(base, resolved)) {
    throw new Error(`Path is outside its allowed directory: ${original}`);
  }
}

async function realpathOrNull(path: string) {
  try {
    return await fs.realpath(path);
  } catch {
    return null;
  }
}

export async function readFile(path: string) {
  return fs.readFile(path);
}

export async function writeFile(path: string, content: WriteFileData, options?: WriteFileOptions) {
  await fs.mkdir(nodePath.dirname(path), { recursive: true });
  await fs.writeFile(path, content, options);
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (error) {
    return false;
  }
}

export async function rm(path: string, options?: { recursive?: boolean }) {
  await fs.rm(path, options);
}

export async function rename(oldPath: string, newPath: string) {
  await fs.rename(oldPath, newPath);
}

export async function readdir(path: string) {
  return fs.readdir(path);
}

export async function isDirectory(path: string) {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch (_) {
    return false;
  }
}

/**
 * Returns whether or not the provided directory is writable (can create files/folders inside it).
 * The directory should exist. If it doesn't, it will return false.
 */
export async function isWritable(path: string): Promise<boolean> {
  const testFilePath = nodePath.join(path, '.Test-Write' + Date.now());

  try {
    // Try to create the file and then delete it
    await fs.writeFile(testFilePath, '');
    await fs.rm(testFilePath);
    return true;
  } catch (error) {
    return false; // Permission denied, directory does't exist or some other error
  }
}

export async function mkdir(path: string, options?: { recursive?: boolean }) {
  await fs.mkdir(path, options);
}

export async function rmdir(path: string) {
  await fs.rmdir(path);
}

export async function stat(path: string) {
  return fs.stat(path);
}

export async function cp(src: string, dest: string, options?: { recursive?: boolean }) {
  await fs.cp(src, dest, options);
}

export async function openPath(path: string) {
  await shell.openPath(path);
}

/**
 * Reveals `path` in the OS file manager, selecting it without opening it.
 *
 * Preferred over `openPath` for any path this process did not choose itself: `openPath`
 * invokes the handler the OS registered for the path's type, and some types run on open. A
 * "is it a directory" test does not distinguish them, since a macOS bundle is a directory.
 */
export async function showItemInFolder(path: string) {
  shell.showItemInFolder(path);
}
