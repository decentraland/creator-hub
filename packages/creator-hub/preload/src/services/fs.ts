import fs from 'fs/promises';
import nodePath from 'path';
import { shell } from 'electron';

type WriteFileData = Parameters<typeof fs.writeFile>[1];
type WriteFileOptions = Parameters<typeof fs.writeFile>[2];

export async function resolve(...paths: string[]) {
  return nodePath.resolve(...paths);
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
