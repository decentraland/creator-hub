import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream } from 'stream/web';
import archiver, { type ZipEntryData } from 'archiver';
import { net } from 'electron';
import pLimit from 'p-limit';
import DCLIGNORE from './scene-export-template/template.dclignore?raw';
import PACKAGE_JSON from './scene-export-template/template.package.json?raw';
import TSCONFIG_JSON from './scene-export-template/template.tsconfig.json?raw';

import type {
  SceneExportOptions,
  SceneExportProgress,
  SceneExportResult,
} from '/shared/types/scene-export';

const CONTENT_HASH = /^[a-zA-Z0-9]+$/;
const UNSAFE_PATH_CHARS = /[\\:\0]/;
const NPM_FILES = new Set([
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',
  'package-lock.json',
  'yarn.lock',
  'node_modules',
]);
const STORED_EXTENSIONS = new Set([
  '.glb',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ktx2',
  '.mp3',
  '.ogg',
  '.mp4',
  '.webm',
  '.zip',
]);
const BUILD_DIR = 'original-build';
const SOURCE_MAP = `${BUILD_DIR}/bin/index.js.map`;
const DOWNLOAD_CONCURRENCY = 8;

const EMPTY_ENTRY_POINT = 'export function main() {}\n';
const PROJECT_FILES = new Map([
  ['package.json', PACKAGE_JSON],
  ['tsconfig.json', TSCONFIG_JSON],
  ['.dclignore', DCLIGNORE],
]);

type Entity = {
  pointers?: unknown;
  metadata?: { display?: { title?: unknown } };
  content?: unknown;
};

type Source = { hash: string } | { content: string };

const running = new Map<string, AbortController>();

function toExportPath(file: unknown): string | null {
  if (typeof file !== 'string' || UNSAFE_PATH_CHARS.test(file)) return null;
  const segments = file.split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) return null;
  const reserved =
    PROJECT_FILES.has(file) || NPM_FILES.has(segments[0]) || segments.includes('node_modules');
  return reserved ? null : file;
}

function slugify(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 64)
    .replace(/^-+|-+$/g, '');
}

function recoverSources(rawMap: string): [string, string][] {
  let map: { sources?: unknown; sourcesContent?: unknown };
  try {
    map = JSON.parse(rawMap);
  } catch {
    return [];
  }
  const { sources, sourcesContent } = map;
  if (!Array.isArray(sources) || !Array.isArray(sourcesContent)) return [];
  return sources.flatMap((source, index): [string, string][] => {
    const content = sourcesContent[index];
    if (typeof source !== 'string' || typeof content !== 'string') return [];
    if (source.startsWith('/') || source.endsWith('.entry-point.ts')) return [];
    const rerooted = path.posix.normalize(`bin/${source}`).replace(/^(\.\.\/)+/, '');
    const file = toExportPath(rerooted);
    return file ? [[file, content]] : [];
  });
}

async function request(url: string, signal: AbortSignal): Promise<Response> {
  const response = await net.fetch(url, { signal });
  if (!response.ok) throw new Error(`GET ${url} failed with status ${response.status}`);
  return response;
}

/**
 * Downloads a deployed scene entity from a catalyst and writes it to `outputPath` as a zip
 * that Creator Hub can import: one root folder holding the deployed files, the deployed build
 * under `original-build/`, the empty-scene template's project files, and any TypeScript
 * recovered from the build's source map.
 */
export async function exportScene(
  { entityId, peerUrl, outputPath }: SceneExportOptions,
  onProgress: (progress: SceneExportProgress) => void = () => {},
): Promise<SceneExportResult> {
  if (!CONTENT_HASH.test(entityId)) throw new Error(`Invalid entity id: ${entityId}`);
  if (new URL(peerUrl).protocol !== 'https:') throw new Error(`Invalid catalyst URL: ${peerUrl}`);
  if (running.has(entityId)) throw new Error(`Scene ${entityId} is already being exported`);

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dcl-scene-export-'));
  const controller = new AbortController();
  const { signal } = controller;
  running.set(entityId, controller);
  const contentUrl = `${peerUrl.replace(/\/+$/, '')}/content/contents/`;
  const partialPath = `${outputPath}.part`;

  try {
    const entity: Entity = await (await request(`${contentUrl}${entityId}`, signal)).json();
    const files = new Map<string, Source>(
      [...PROJECT_FILES].map(([file, content]) => [file, { content }]),
    );
    const hashes = new Set<string>();
    const skipped: string[] = [];
    for (const item of Array.isArray(entity.content) ? entity.content : []) {
      const file = toExportPath(item?.file);
      const hash = item?.hash;
      if (!file || typeof hash !== 'string' || !CONTENT_HASH.test(hash)) {
        skipped.push(String(item?.file));
        continue;
      }
      files.set(file.startsWith('bin/') ? `${BUILD_DIR}/${file}` : file, { hash });
      hashes.add(hash);
    }

    const limit = pLimit(DOWNLOAD_CONCURRENCY);
    let downloaded = 0;
    const downloads = [...hashes].map(hash =>
      limit(async () => {
        const response = await request(`${contentUrl}${hash}`, signal);
        await pipeline(
          Readable.fromWeb(response.body as ReadableStream),
          createWriteStream(path.join(tmp, hash)),
          { signal },
        );
        downloaded += 1;
        onProgress({ entityId, phase: 'download', done: downloaded, total: hashes.size });
      }).catch(error => controller.abort(error)),
    );
    await Promise.all(downloads);
    if (signal.aborted) throw signal.reason;

    const sourceMap = files.get(SOURCE_MAP);
    const recovered =
      sourceMap && 'hash' in sourceMap
        ? recoverSources(await fs.readFile(path.join(tmp, sourceMap.hash), 'utf8'))
        : [];
    for (const [file, content] of recovered) files.set(file, { content });
    if (!files.has('src/index.ts')) files.set('src/index.ts', { content: EMPTY_ENTRY_POINT });

    const pointers = Array.isArray(entity.pointers) ? entity.pointers : [];
    const root =
      slugify(entity.metadata?.display?.title) || slugify(`scene ${pointers[0]}`) || 'scene';
    const archive = archiver('zip');
    archive.on('progress', ({ entries }) =>
      onProgress({ entityId, phase: 'zip', done: entries.processed, total: entries.total }),
    );
    for (const [file, source] of files) {
      const name = `${root}/${file}`;
      if ('hash' in source) {
        const entry: ZipEntryData = {
          name,
          store: STORED_EXTENSIONS.has(path.posix.extname(file).toLowerCase()),
        };
        archive.file(path.join(tmp, source.hash), entry);
      } else {
        archive.append(source.content, { name });
      }
    }
    await Promise.all([
      pipeline(archive, createWriteStream(partialPath), { signal }),
      archive.finalize(),
    ]);
    await fs.rename(partialPath, outputPath);

    const { size } = await fs.stat(outputPath);
    return { files: files.size, bytes: size, recoveredSources: recovered.length, skipped };
  } catch (error) {
    controller.abort(error);
    await fs.rm(partialPath, { force: true });
    throw error;
  } finally {
    running.delete(entityId);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** Aborts the running export of `entityId`, if any; its `exportScene` call rejects. */
export function cancelSceneExport(entityId: string): void {
  running.get(entityId)?.abort();
}
