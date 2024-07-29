import fs from 'fs/promises';
import path from 'path';

export async function resolve(...paths: string[]) {
  return path.resolve(...paths);
}

export async function readFile(path: string) {
  return fs.readFile(path);
}

export async function writeFile(_path: string, content: Buffer) {
  await fs.mkdir(path.dirname(_path), { recursive: true });
  await fs.writeFile(_path, content as any);
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
