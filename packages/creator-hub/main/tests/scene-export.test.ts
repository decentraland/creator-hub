import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yauzl from 'yauzl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneExportProgress } from '/shared/types/scene-export';

import { Env } from '/shared/types/env';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showSaveDialog: vi.fn(),
  env: { value: null as string | null },
}));

vi.mock('electron', () => ({ net: { fetch: mocks.fetch } }));

vi.mock('../src/modules/electron', () => ({
  getEnvOverride: () => mocks.env.value,
  showSaveDialog: mocks.showSaveDialog,
}));

import { cancelSceneExport, exportScene, saveScene } from '../src/modules/scene-export';

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

function serve(contents: Record<string, string | Buffer>, entity: unknown, peer = PEER) {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url === `${peer}/content/contents/${ENTITY_ID}`) {
      return new Response(JSON.stringify(entity));
    }
    const hash = url.slice(`${peer}/content/contents/`.length);
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

    it('should explain in RECOVERY.md that the deployed build is the only copy of the logic', () => {
      const notes = text(entries, 'scene-0-0/RECOVERY.md')!;
      expect(notes).toContain('original-build/');
      expect(notes).toMatch(/could not be recovered/);
    });
  });

  describe('when recovering sources from a source map', () => {
    async function exportWithMap(map: { sources: string[]; sourcesContent: (string | null)[] }) {
      serve(
        { hscene: sceneJson, hindex: 'bundle', hmap: JSON.stringify({ version: 3, ...map }) },
        {
          id: ENTITY_ID,
          pointers: ['0,0'],
          metadata: { display: { title: 'Recovered' } },
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'bin/index.js', hash: 'hindex' },
            { file: 'bin/index.js.map', hash: 'hmap' },
          ],
        },
      );
      const result = await exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath });
      return { result, entries: await readZip(outputPath) };
    }

    describe('and every import resolves to a recovered file or a bundled allowed package', () => {
      let result: Awaited<ReturnType<typeof exportScene>>;
      let entries: Map<string, ZipEntry>;
      const index = [
        "import { engine } from '@dcl/sdk/ecs'",
        "import * as utils from '@dcl-sdk/utils'",
        "import { door } from './systems/door'",
        "import { movePlayerTo } from '~system/RestrictedActions'",
        "  //import './retired-feature'",
        'export function main() { door }',
      ].join('\n');

      beforeEach(async () => {
        ({ result, entries } = await exportWithMap({
          sources: [
            '../src/index.ts',
            '../src/systems/door.ts',
            '../node_modules/@dcl-sdk/utils/dist/index.js',
            '../node_modules/@dcl/ecs/dist/index.js',
          ],
          sourcesContent: [index, 'export const door = 1', 'utils', 'ecs'],
        }));
      });

      it('should report the scene as self-contained', () => {
        expect(result.recovered).toBe('self-contained');
        expect(result.recoveredSources).toBe(2);
      });

      it('should put the recovered sources in src', () => {
        expect(text(entries, 'recovered/src/index.ts')).toBe(index);
        expect(text(entries, 'recovered/src/systems/door.ts')).toBe('export const door = 1');
        expect([...entries.keys()].some(name => name.includes('recovered-src'))).toBe(false);
      });

      it('should add the imported allowed packages as dependencies', () => {
        const pkg = JSON.parse(text(entries, 'recovered/package.json')!);
        expect(pkg.dependencies).toEqual({ '@dcl-sdk/utils': 'latest' });
      });

      it('should describe what was recovered in RECOVERY.md', () => {
        const notes = text(entries, 'recovered/RECOVERY.md')!;
        expect(notes).toContain('src/');
        expect(notes).toContain('@dcl-sdk/utils');
        expect(notes).toContain('original-build/');
      });
    });

    describe('and the code imports packages that @dcl/sdk already brings in', () => {
      it('should add only the separately versioned package, beside the template SDK', async () => {
        const { entries } = await exportWithMap({
          sources: [
            '../src/index.ts',
            '../node_modules/@dcl/ecs/dist/index.js',
            '../node_modules/@dcl/react-ecs/dist/index.js',
            '../node_modules/@dcl/ecs-math/dist/index.js',
            '../node_modules/@dcl-sdk/utils/dist/index.js',
          ],
          sourcesContent: [
            [
              "import { engine } from '@dcl/ecs'",
              "import ReactEcs from '@dcl/react-ecs'",
              "import { Vector3 } from '@dcl/ecs-math'",
              "import * as utils from '@dcl-sdk/utils'",
              'export function main() {}',
            ].join('\n'),
            'ecs',
            'react-ecs',
            'ecs-math',
            'utils',
          ],
        });

        const pkg = JSON.parse(text(entries, 'recovered/package.json')!);
        expect(pkg.dependencies).toEqual({ '@dcl-sdk/utils': 'latest' });
        expect(pkg.devDependencies['@dcl/sdk']).toBe('latest');
      });
    });

    describe('and the sources rely on aliases, missing files and unreviewed packages', () => {
      let result: Awaited<ReturnType<typeof exportScene>>;
      let entries: Map<string, ZipEntry>;
      const index = [
        "import { artworks } from '@lib'",
        'import config from "@config"',
        "import { helper } from '../lib/src'",
        "import { chunk } from 'lodash'",
        "import * as utils from '@dcl-sdk/utils'",
        'export function main() {}',
      ].join('\n');

      beforeEach(async () => {
        ({ result, entries } = await exportWithMap({
          sources: [
            '../src/index.ts',
            '../../lib/src/util.ts',
            '../node_modules/lodash/lodash.js',
            '../node_modules/@dcl-sdk/utils/dist/index.js',
          ],
          sourcesContent: [index, 'export const util = 1', 'lodash', 'utils'],
        }));
      });

      it('should report the recovery as partial', () => {
        expect(result.recovered).toBe('partial');
        expect(result.recoveredSources).toBe(2);
      });

      it('should keep the recovered sources under recovered-src and the stub entry point', () => {
        expect(text(entries, 'recovered/recovered-src/src/index.ts')).toBe(index);
        expect(text(entries, 'recovered/recovered-src/lib/src/util.ts')).toBe(
          'export const util = 1',
        );
        expect(text(entries, 'recovered/src/index.ts')).toBe('export function main() {}\n');
        expect(entries.has('recovered/lib/src/util.ts')).toBe(false);
      });

      it('should exclude recovered-src from the build and from deployments', () => {
        const tsconfig = JSON.parse(text(entries, 'recovered/tsconfig.json')!);
        expect(tsconfig.exclude).toContain('recovered-src');
        expect(text(entries, 'recovered/.dclignore')!.split('\n')).toContain('recovered-src');
      });

      it('should add only the allowed packages as dependencies', () => {
        const pkg = JSON.parse(text(entries, 'recovered/package.json')!);
        expect(pkg.dependencies).toEqual({ '@dcl-sdk/utils': 'latest' });
      });

      it('should list every build blocker in RECOVERY.md', () => {
        const notes = text(entries, 'recovered/RECOVERY.md')!;
        expect(notes).toContain('recovered-src/');
        expect(notes).toContain('@lib');
        expect(notes).toContain('@config');
        expect(notes).toContain('lib/src');
        expect(notes).toContain('lodash');
        expect(notes).toContain('original-build/');
      });
    });

    describe('and the map names packages outside the allow-list', () => {
      let result: Awaited<ReturnType<typeof exportScene>>;
      let entries: Map<string, ZipEntry>;

      beforeEach(async () => {
        ({ result, entries } = await exportWithMap({
          sources: [
            '../src/index.ts',
            '../node_modules/evil-pkg/index.js',
            '../node_modules/@dcl-evil/x/index.js',
          ],
          sourcesContent: [
            "import 'evil-pkg'\nconst x = require('@dcl-evil/x')\nexport function main() {}",
            'evil',
            'evil',
          ],
        }));
      });

      it('should add neither package and report the recovery as partial', () => {
        const pkg = JSON.parse(text(entries, 'recovered/package.json')!);
        expect(pkg.dependencies).toBeUndefined();
        expect(result.recovered).toBe('partial');
        const notes = text(entries, 'recovered/RECOVERY.md')!;
        expect(notes).toContain('evil-pkg');
        expect(notes).toContain('@dcl-evil/x');
      });
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

  describe('when entity file names are case or dot variants of reserved paths', () => {
    let entries: Map<string, ZipEntry>;

    beforeEach(async () => {
      serve(
        { hscene: sceneJson, hok: 'ok', hpkg: '{"name":"deployed"}' },
        {
          id: ENTITY_ID,
          pointers: ['1,1'],
          metadata: { display: { title: 'x' } },
          content: [
            { file: 'scene.json', hash: 'hscene' },
            { file: 'NODE_MODULES/x/index.js', hash: 'hok' },
            { file: '.NPMRC', hash: 'hok' },
            { file: '.git/config', hash: 'hok' },
            { file: 'node_modules./x', hash: 'hok' },
            { file: 'node_modules /y', hash: 'hok' },
            { file: '.vscode/tasks.json', hash: 'hok' },
            { file: 'PACKAGE.JSON', hash: 'hpkg' },
            { file: 'Original-Build/bin/index.js', hash: 'hok' },
            { file: 'SRC/INDEX.TS', hash: 'hok' },
          ],
        },
      );
      await exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath });
      entries = await readZip(outputPath);
    });

    it('should skip every variant of node_modules and of a dotfile', () => {
      const names = [...entries.keys()].map(name => name.toLowerCase());
      expect(names.some(name => /node_modules|npmrc|\.git\/|\.vscode/.test(name))).toBe(false);
      expect(names.some(name => name.startsWith('x/original-build/'))).toBe(false);
    });

    it('should keep only the template package.json', () => {
      const packages = [...entries.keys()].filter(name => name.toLowerCase() === 'x/package.json');
      expect(packages).toEqual(['x/package.json']);
      expect(JSON.parse(text(entries, 'x/package.json')!).name).toBe('dcl-project');
    });

    it('should write one entry point, the deployed one', () => {
      const entryPoints = [...entries.keys()].filter(
        name => name.toLowerCase() === 'x/src/index.ts',
      );
      expect(entryPoints).toEqual(['x/SRC/INDEX.TS']);
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

    it('should cancel the failed response body', async () => {
      const failed = new Response('not found', { status: 404 });
      const cancel = vi.spyOn(failed.body!, 'cancel');
      const serveEntity = mocks.fetch.getMockImplementation()!;
      mocks.fetch.mockImplementation(async (url: string) =>
        url.endsWith('hmissing') ? failed : serveEntity(url),
      );

      await expect(
        exportScene({ entityId: ENTITY_ID, peerUrl: PEER, outputPath }),
      ).rejects.toThrow();
      expect(cancel).toHaveBeenCalled();
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

  describe('when saving a scene from the renderer', () => {
    beforeEach(() => {
      mocks.env.value = Env.PROD;
      serve(
        { hscene: sceneJson },
        {
          id: ENTITY_ID,
          pointers: ['0,0'],
          content: [{ file: 'scene.json', hash: 'hscene' }],
        },
        'https://peer.decentraland.org',
      );
    });

    describe('and the user picks a file', () => {
      let result: Awaited<ReturnType<typeof saveScene>>;

      beforeEach(async () => {
        mocks.showSaveDialog.mockResolvedValue(outputPath);
        result = await saveScene(ENTITY_ID, 'My Cool Scene!');
      });

      it('should suggest a file named after the scene', () => {
        expect(mocks.showSaveDialog).toHaveBeenCalledWith(
          expect.objectContaining({ defaultPath: 'my-cool-scene.zip' }),
        );
      });

      it("should export from the catalyst of the app's environment to that file", async () => {
        expect(mocks.fetch).toHaveBeenCalledWith(
          `https://peer.decentraland.org/content/contents/${ENTITY_ID}`,
          expect.anything(),
        );
        expect(result?.bytes).toBe((await fs.stat(outputPath)).size);
      });
    });

    describe('and the user cancels the dialog', () => {
      it('should resolve null without fetching', async () => {
        mocks.showSaveDialog.mockResolvedValue(null);
        await expect(saveScene(ENTITY_ID, 'x')).resolves.toBeNull();
        expect(mocks.fetch).not.toHaveBeenCalled();
      });
    });
  });
});
