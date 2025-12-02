import fs from 'fs';
import { resolve, dirname } from 'path';
import future from 'fp-future';

export function exists(path: string) {
  const promise = future<boolean>();
  fs.stat(path, err => {
    if (err == null) {
      promise.resolve(true);
    } else if (err.code === 'ENOENT') {
      promise.resolve(false);
    } else {
      promise.reject(new Error(err.code));
    }
  });
  return promise;
}

export async function createDirectory(path: string) {
  if (await exists(path)) {
    return;
  }
  const promise = future<void>();
  fs.mkdir(path, { recursive: true }, err => (err ? promise.reject(err) : promise.resolve()));
  return promise;
}

export async function writeFile(path: string, data: string | Buffer) {
  const promise = future<void>();
  const dir = dirname(path);
  await createDirectory(dir);
  fs.writeFile(path, data, 'utf8', err => (err ? promise.reject(err) : promise.resolve()));
  return promise;
}

export async function readJson(path: string) {
  const promise = future<string>();
  fs.readFile(path, 'utf8', (err, data) => (err ? promise.reject(err) : promise.resolve(data)));
  const data = await promise;
  return JSON.parse(data);
}

export function readBuffer(path: string) {
  const promise = future<Buffer>();
  fs.readFile(path, (err, data) => (err ? promise.reject(err) : promise.resolve(data)));
  return promise;
}

export function isDirectory(path: string) {
  const promise = future<boolean>();
  fs.lstat(path, (err, stats) =>
    err ? promise.reject(err) : promise.resolve(stats.isDirectory()),
  );
  return promise;
}

export function list(path: string) {
  const promise = future<string[]>();
  fs.readdir(path, async (err, files) => {
    if (err) {
      promise.reject(err);
    } else {
      promise.resolve(files);
    }
  });
  return promise;
}

export async function getSubfolders(path: string) {
  const paths = await list(path);
  const results = await Promise.all(
    paths.map(async file => {
      return {
        file,
        isDirectory: await isDirectory(resolve(path, file)),
      };
    }),
  );
  return results.filter(result => result.isDirectory).map(result => resolve(path, result.file));
}

export async function getFiles(path: string) {
  const paths = await list(path);
  const results = await Promise.all(
    paths.map(async file => {
      return {
        file,
        isDirectory: await isDirectory(resolve(path, file)),
      };
    }),
  );
  const files: string[] = [];
  for (const result of results) {
    if (result.isDirectory) {
      const subfiles = await getFiles(resolve(path, result.file));
      for (const subfile of subfiles) {
        files.push(subfile);
      }
    } else {
      files.push(resolve(path, result.file));
    }
  }
  return files;
}

export function move(from: string, to: string) {
  const promise = future<void>();
  fs.rename(from, to, err => (err ? promise.reject(err) : promise.resolve()));
  return promise;
}
