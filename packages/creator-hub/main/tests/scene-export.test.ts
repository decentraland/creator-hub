import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yauzl from 'yauzl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneExportProgress } from '/shared/types/scene-export';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('electron', () => ({ net: { fetch: mocks.fetch } }));

import { cancelSceneExport, exportScene } from '../src/modules/scene-export';

const PEER = 'https://peer.example.org';
const ENTITY_ID = 'bafkreientity';

type ZipEntry = { data: Buffer; compressionMethod: number };

function readZip(file: string): Promise<Map<string, ZipEntry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, ZipEntry>();
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', () => resolve(entries));
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) return reject(streamErr);
          const chunks: Buffer[] = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('end', () => {
            entries.set(entry.fileName, {
              data: Buffer.concat(chunks),
              compressionMethod: entry.compressionMethod,
            });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

function text(entries: Map<string, ZipEntry>, name: string) {
  return entries.get(name)?.data.toString('utf8');
}

function serve(contents: Record<string, string | Buffer>, entity: unknown) {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url === `${PEER}/content/contents/${ENTITY_ID}`) {
      return new Response(JSON.stringify(entity));
    }
    const hash = url.slice(`${PEER}/content/contents/`.length);
    const body = contents[hash];
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(typeof body === 'string' ? body : new Uint8Array(body));
  });
}

const sceneJson = JSON.stringify({ display: { title: 'My Cool Scene!' }, main: 'bin/index.js' });
const sourceMap = JSON.stringify({
  version: 3,
  sourceRoot: 'dcl:///',
  sources: [
    '../src/index.ts',
    '../src/systems/door.ts',
    '../src/index.ts.entry-point.ts',
    '../../lib/src/helpers.ts',
    '../../node_modules/@dcl/ecs/dist/index.js',
    '/etc/passwd',
    'webpack://evil/x.ts',
    '../src/no-content.ts',
    '../package.json',
    '../.npmrc',
  ],
  sourcesContent: [
    'export function main() { recovered() }',
    'export const door = 1',
    'entry point wrapper',
    'export const helper = 2',
    'sdk code',
    'root:x',
    'evil',
    null,
    '{"name":"from-map","scripts":{"postinstall":"evil"}}',
    'registry=https://evil.example.org',
  ],
});

describe('exportScene', () => {
  let dir: string;
  let outputPath: string;

  beforeEach(async () => {
    mocks.fetch.mockReset();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-export-test-'));
    outputPath = path.join(dir, 'out.zip');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('when the deployed build ships a source map with sourcesContent', () => {
    let entries: Map<string, ZipEntry>;
    let progress: SceneExportProgress[];

    beforeEach(async () => {
      serve(
        {
          hscene: sceneJson,
          hindex: 'console.log("bundle")',
          hmap: sourceMap,
          hpkg: '{"name":"deployed","dependencies":{}}',
          hpng: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
          hcomposite: '{"version":1}',
        },
        {
          id: ENTITY_ID,
          type: 'scene',
          pointers: ['-150,150'],
          metadata: { display: { title: 'My Cool Scene!' } },
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'bin/index.js', hash: 'hindex' },
            { file: 'bin/index.js.map', hash: 'hmap' },
            { file: 'package.json', hash: 'hpkg' },
            { file: 'images/a.png', hash: 'hpng' },
            { file: 'images/copy-of-a.png', hash: 'hpng' },
            { file: 'assets/scene/main.composite', hash: 'hcomposite' },
          ],
        },
      );
      progress = [];
      await exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath }, p => progress.push(p));
      entries = await readZip(outputPath);
    });

    it('should put every entry under a single folder named after the scene title', () => {
      for (const name of entries.keys()) expect(name.startsWith('my-cool-scene/')).toBe(true);
    });

    it('should keep the deployed files and scene.json as deployed', () => {
      expect(text(entries, 'my-cool-scene/scene.json')).toBe(sceneJson);
      expect(text(entries, 'my-cool-scene/assets/scene/main.composite')).toBe('{"version":1}');
      expect(entries.get('my-cool-scene/images/a.png')?.data).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
      );
      expect(entries.get('my-cool-scene/images/copy-of-a.png')?.data.length).toBe(7);
    });

    it('should download each unique content hash once', () => {
      const urls = mocks.fetch.mock.calls.map(([url]) => url);
      expect(urls.filter(url => url.endsWith('/hpng'))).toHaveLength(1);
    });

    it('should move the deployed build under original-build', () => {
      expect(entries.has('my-cool-scene/bin/index.js')).toBe(false);
      expect(text(entries, 'my-cool-scene/original-build/bin/index.js')).toBe(
        'console.log("bundle")',
      );
      expect(text(entries, 'my-cool-scene/original-build/bin/index.js.map')).toBe(sourceMap);
    });

    it('should replace the deployed package.json with one depending on @dcl/sdk', () => {
      const pkg = JSON.parse(text(entries, 'my-cool-scene/package.json')!);
      expect(pkg.devDependencies['@dcl/sdk']).toBeDefined();
      expect(pkg.devDependencies['@dcl/js-runtime']).toBeDefined();
      expect(pkg.name).not.toBe('deployed');
      expect(pkg.name).not.toBe('from-map');
      expect(pkg.scripts.postinstall).toBeUndefined();
    });

    it('should add a tsconfig.json and a .dclignore that ignores original-build', () => {
      expect(JSON.parse(text(entries, 'my-cool-scene/tsconfig.json')!).extends).toBe(
        '@dcl/sdk/types/tsconfig.ecs7.json',
      );
      expect(text(entries, 'my-cool-scene/.dclignore')!.split('\n')).toContain('original-build');
    });

    it("should recover the scene's own sources into src, replacing the stub entry point", () => {
      expect(text(entries, 'my-cool-scene/src/index.ts')).toBe(
        'export function main() { recovered() }',
      );
      expect(text(entries, 'my-cool-scene/src/systems/door.ts')).toBe('export const door = 1');
      expect(text(entries, 'my-cool-scene/lib/src/helpers.ts')).toBe('export const helper = 2');
    });

    it('should drop SDK, node_modules, entry-point and unsafe sources', () => {
      const names = [...entries.keys()];
      expect(names.some(name => name.includes('node_modules'))).toBe(false);
      expect(names.some(name => name.endsWith('.entry-point.ts'))).toBe(false);
      expect(names.some(name => name.includes('passwd'))).toBe(false);
      expect(names.some(name => name.includes('evil'))).toBe(false);
      expect(entries.has('my-cool-scene/src/no-content.ts')).toBe(false);
      expect(entries.has('my-cool-scene/.npmrc')).toBe(false);
    });

    it('should store already-compressed files without recompressing them', () => {
      expect(entries.get('my-cool-scene/images/a.png')?.compressionMethod).toBe(0);
      expect(entries.get('my-cool-scene/scene.json')?.compressionMethod).toBe(8);
    });

    it('should report download progress up to the number of unique files', () => {
      const downloads = progress.filter(p => p.phase === 'download');
      expect(downloads.at(-1)).toEqual({
        entityId: ENTITY_ID,
        phase: 'download',
        done: 5,
        total: 5,
      });
    });
  });

  describe('when the deployed build has no source map', () => {
    let entries: Map<string, ZipEntry>;

    beforeEach(async () => {
      serve(
        { hscene: sceneJson, hindex: 'bundle' },
        {
          id: ENTITY_ID,
          pointers: ['0,0'],
          metadata: {},
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'bin/index.js', hash: 'hindex' },
          ],
        },
      );
      await exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath });
      entries = await readZip(outputPath);
    });

    it('should fall back to the base parcel for the folder name', () => {
      expect(entries.has('scene-0-0/scene.json')).toBe(true);
    });

    it('should add an empty src/index.ts entry point', () => {
      expect(text(entries, 'scene-0-0/src/index.ts')).toBe('export function main() {}\n');
    });
  });

  describe('when entity file names or hashes are unsafe', () => {
    let entries: Map<string, ZipEntry>;

    beforeEach(async () => {
      serve(
        { hscene: sceneJson, hok: 'ok' },
        {
          id: ENTITY_ID,
          pointers: ['1,1'],
          metadata: { display: { title: 'x' } },
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'models/ok.glb', hash: 'hok' },
            { file: '../escape.txt', hash: 'hok' },
            { file: 'a/../../escape2.txt', hash: 'hok' },
            { file: '/abs.txt', hash: 'hok' },
            { file: 'win\\path.txt', hash: 'hok' },
            { file: 'C:/drive.txt', hash: 'hok' },
            { file: 'double//slash.txt', hash: 'hok' },
            { file: 'bad-hash.txt', hash: '../../content/x' },
            { file: '.npmrc', hash: 'hok' },
            { file: 'package-lock.json', hash: 'hok' },
            { file: 'node_modules/x/index.js', hash: 'hok' },
          ],
        },
      );
      await exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath });
      entries = await readZip(outputPath);
    });

    it('should skip them and keep the safe files', () => {
      expect(entries.has('x/models/ok.glb')).toBe(true);
      const names = [...entries.keys()];
      expect(names.every(name => name.startsWith('x/'))).toBe(true);
      expect(names.some(name => /escape|abs|path|drive|slash|bad-hash/.test(name))).toBe(false);
      expect(names.some(name => /npmrc|package-lock|node_modules/.test(name))).toBe(false);
    });

    it('should never request an unsafe hash', () => {
      const urls = mocks.fetch.mock.calls.map(([url]) => url as string);
      expect(urls.some(url => url.includes('..'))).toBe(false);
    });
  });

  describe('when the entity id is not a content hash', () => {
    it('should reject without fetching', async () => {
      await expect(exportScene({ entityId: '../x', peerUrl: PEER, outputPath })).rejects.toThrow();
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
  });

  describe('when a content download fails', () => {
    beforeEach(() => {
      serve(
        { hscene: sceneJson },
        {
          id: ENTITY_ID,
          pointers: ['0,0'],
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'missing.glb', hash: 'hmissing' },
          ],
        },
      );
    });

    it('should reject and leave no file behind', async () => {
      await expect(exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath })).rejects.toThrow(
        /404/,
      );
      expect(await fs.readdir(dir)).toEqual([]);
    });
  });

  describe('when the export is cancelled mid-download', () => {
    beforeEach(() => {
      mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith(ENTITY_ID)) {
          return new Response(
            JSON.stringify({
              id: ENTITY_ID,
              pointers: ['0,0'],
              content: [{ file: 'scene.json', hash: 'hscene' }],
            }),
          );
        }
        cancelSceneExport(ENTITY_ID);
        return new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          init?.signal?.addEventListener('abort', abort);
        });
      });
    });

    it('should reject and leave no file behind', async () => {
      await expect(
        exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath }),
      ).rejects.toThrow();
      expect(await fs.readdir(dir)).toEqual([]);
    });
  });
});
