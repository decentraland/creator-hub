import fs from 'fs/promises';
import path from 'path';

type WriteFileData = Parameters<typeof fs.writeFile>[1];
type WriteFileOptions = Parameters<typeof fs.writeFile>[2];

export async function resolve(...paths: string[]) {
  return path.resolve(...paths);
}

export async function readFile(path: string) {
  return fs.readFile(path);
}

export async function writeFile(scenePath: string, content: WriteFileData, options?: WriteFileOptions) {
  await fs.mkdir(path.dirname(scenePath), { recursive: true });
  await fs.writeFile(scenePath, content, options);
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (error) {
    return false;
  }
}

export async function rm(path: string) {
  await fs.rm(path);
}

export async function readdir(path: string) {
  return fs.readdir(path);
}

export async function isDirectory(path: string) {
  return (await fs.stat(path)).isDirectory();
}

export async function mkdir(path: string) {
  await fs.mkdir(path);
}
