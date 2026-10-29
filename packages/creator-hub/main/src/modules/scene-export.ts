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

import type { SceneExportProgress, SceneExportResult } from '/shared/types/scene-export';

import { getPeerUrl } from './catalyst';
import { showSaveDialog } from './electron';

const CONTENT_HASH = /^[a-zA-Z0-9]+$/;
const UNSAFE_PATH_CHARS = /[\\:\0]/;
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

const RECOVERED_DIR = 'recovered-src';
const EMPTY_ENTRY_POINT = 'export function main() {}\n';
const RESERVED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'tsconfig.json',
  'recovery.md',
]);
const RESERVED_DIRS = new Set([BUILD_DIR, RECOVERED_DIR]);
const PROVIDED_PACKAGES = new Set([
  '@dcl/sdk',
  '@dcl/ecs',
  '@dcl/ecs-math',
  '@dcl/js-runtime',
  '@dcl/react-ecs',
  '@dcl/sdk-commands',
]);
const ALLOWED_SCOPES = ['@dcl/', '@dcl-sdk/'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IMPORT_SPECIFIERS = [
  /\b(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\b(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];
const LINE_COMMENT = /^\s*\/\/.*$/gm;
const BUNDLED_PACKAGE = /node_modules\/((?:@[^/]+\/)?[^/]+)/g;

type Entity = {
  pointers?: unknown;
  metadata?: { display?: { title?: unknown } };
  content?: unknown;
};

type Source = { hash: string } | { content: string };

type SceneExportOptions = { entityId: string; peerUrl: string; outputPath: string };

type Recovery = {
  status: SceneExportResult['recovered'];
  sources: [string, string][];
  dependencies: string[];
  unresolved: string[];
  missing: [string, string[]][];
  review: string[];
};

const running = new Map<string, AbortController>();

function canonicalPath(file: string): string {
  return file
    .split('/')
    .map(segment =>
      segment
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[. ]+$/, ''),
    )
    .join('/');
}

function toExportPath(file: unknown): string | null {
  if (typeof file !== 'string' || UNSAFE_PATH_CHARS.test(file)) return null;
  const key = canonicalPath(file);
  const segments = key.split('/');
  const unsafe = segments.some(
    segment => segment === '' || segment.startsWith('.') || segment === 'node_modules',
  );
  return unsafe || RESERVED_FILES.has(key) || RESERVED_DIRS.has(segments[0]) ? null : file;
}

function slugify(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 64)
    .replace(/^-+|-+$/g, '');
}

function parseSourceMap(rawMap: string | undefined): { sources: unknown[]; contents: unknown[] } {
  let map: { sources?: unknown; sourcesContent?: unknown } | null = null;
  try {
    map = JSON.parse(rawMap ?? 'null');
  } catch {
    map = null;
  }
  const { sources, sourcesContent } = map ?? {};
  return Array.isArray(sources) && Array.isArray(sourcesContent)
    ? { sources, contents: sourcesContent }
    : { sources: [], contents: [] };
}

function packageName(specifier: string): string {
  const [first, second] = specifier.split('/');
  return first.startsWith('@') && second ? `${first}/${second}` : first;
}

function missingImport(importer: string, specifier: string, files: Set<string>): string | null {
  const target = path.posix.join(path.posix.dirname(importer), specifier);
  const candidates = [
    target,
    target.replace(/\.js$/, '.ts'),
    ...SOURCE_EXTENSIONS.flatMap(extension => [
      `${target}${extension}`,
      `${target}/index${extension}`,
    ]),
  ];
  return candidates.some(candidate => files.has(candidate)) ? null : target;
}

function recoverSources(rawMap: string | undefined): Recovery {
  const { sources, contents } = parseSourceMap(rawMap);
  const recovered = sources.flatMap((source, index): [string, string][] => {
    const content = contents[index];
    if (typeof source !== 'string' || typeof content !== 'string') return [];
    if (source.startsWith('/') || source.endsWith('.entry-point.ts')) return [];
    const rerooted = path.posix.normalize(`bin/${source}`).replace(/^(\.\.\/)+/, '');
    const file = toExportPath(rerooted);
    return file ? [[file, content]] : [];
  });
  const bundled = new Set(
    sources.flatMap(source =>
      typeof source === 'string'
        ? [...source.matchAll(BUNDLED_PACKAGE)].map(match => match[1])
        : [],
    ),
  );
  const files = new Set(recovered.map(([file]) => file));
  const dependencies = new Set<string>();
  const unresolved = new Set<string>();
  const missing = new Map<string, string[]>();
  const review = new Set<string>();
  for (const [file, code] of recovered) {
    const scanned = code.replace(LINE_COMMENT, '');
    const specifiers = IMPORT_SPECIFIERS.flatMap(pattern =>
      [...scanned.matchAll(pattern)].map(match => match[1]),
    );
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const target = missingImport(file, specifier, files);
        if (target) missing.set(target, [...(missing.get(target) ?? []), file]);
        continue;
      }
      const name = packageName(specifier);
      if (specifier.startsWith('~system/') || PROVIDED_PACKAGES.has(name)) continue;
      if (!bundled.has(name)) unresolved.add(name);
      else if (ALLOWED_SCOPES.some(scope => name.startsWith(scope))) dependencies.add(name);
      else review.add(name);
    }
  }
  const selfContained = !unresolved.size && !missing.size && !review.size;
  return {
    status: !recovered.length ? 'none' : selfContained ? 'self-contained' : 'partial',
    sources: recovered,
    dependencies: [...dependencies].sort(),
    unresolved: [...unresolved].sort(),
    missing: [...missing].sort(([a], [b]) => a.localeCompare(b)),
    review: [...review].sort(),
  };
}

function bulletList(items: string[]): string {
  return items.map(item => `- \`${item}\``).join('\n');
}

function missingList(missing: Recovery['missing']): string {
  return missing
    .map(([target, importers]) => `- \`${target}\`, imported by \`${importers.join('`, `')}\``)
    .join('\n');
}

function recoveryNotes({ status, sources, dependencies, unresolved, missing, review }: Recovery) {
  const intro =
    '# About this export\n\nThis project was exported from a scene deployed in Decentraland.';
  const packages = dependencies.length
    ? `These packages were added to \`package.json\`:\n\n${bulletList(dependencies)}`
    : 'No extra packages were added to `package.json`.';
  if (status === 'none') {
    return [
      intro,
      "The scene's original source code was not part of the deployment, so its custom code could not be recovered. `src/index.ts` is an empty starting point.",
      `The compiled code that was deployed is kept in \`${BUILD_DIR}/\`. It is the only copy of the scene's custom logic: use it as a reference to rewrite that logic in \`src/\`. It is never published with the scene (\`.dclignore\` lists it).`,
      '',
    ].join('\n\n');
  }
  const deployedBuild = `The compiled code that was deployed is kept in \`${BUILD_DIR}/\` for reference. It is never published with the scene (\`.dclignore\` lists it).`;
  if (status === 'self-contained') {
    return [
      intro,
      `The scene's original source code was recovered from the deployed build: ${sources.length} files, at their original paths starting in \`src/\`. They are ready to build.`,
      packages,
      deployedBuild,
      '',
    ].join('\n\n');
  }
  const blockers = [
    unresolved.length &&
      `### Imports that don't match any recovered file or package\n\nThese are usually shortcuts set up in the original project's configuration, which is not part of a deployment. Point them at the right files (for example with \`paths\` in \`tsconfig.json\`) or replace them with relative imports:\n\n${bulletList(unresolved)}`,
    missing.length &&
      `### Files that weren't recovered\n\nThese imports point at files that are not in \`${RECOVERED_DIR}/\`. Create them or change the imports:\n\n${missingList(missing)}`,
    review.length &&
      `### Packages to review before installing\n\nThe scene used these packages, but they don't come from Decentraland, so they were not added to \`package.json\`. Check each one before you install it:\n\n${bulletList(review)}`,
  ].filter(Boolean);
  return [
    intro,
    `The scene's original source code was recovered from the deployed build (${sources.length} files), but it can't be built as it is. It is kept in \`${RECOVERED_DIR}/\` at its original paths, and the project starts from an empty \`src/index.ts\` so it always opens and builds. \`${RECOVERED_DIR}/\` is not built or published.`,
    packages,
    '## What stops the recovered code from building',
    ...blockers,
    `## Using the recovered code\n\nOnce the items above are fixed, move the contents of \`${RECOVERED_DIR}/\` to the project root (its \`src/\` replaces the empty one), then remove \`${RECOVERED_DIR}\` from \`tsconfig.json\` and \`.dclignore\`.`,
    `${deployedBuild} Until the recovered code builds, it is the only working copy of the scene's custom logic.`,
    '',
  ].join('\n\n');
}

function projectFiles(recovery: Recovery): [string, string][] {
  const partial = recovery.status === 'partial';
  const dependencies = Object.fromEntries(recovery.dependencies.map(name => [name, 'latest']));
  const packageJson = recovery.dependencies.length
    ? `${JSON.stringify({ ...JSON.parse(PACKAGE_JSON), dependencies }, null, 2)}\n`
    : PACKAGE_JSON;
  const tsconfig = partial
    ? `${JSON.stringify({ ...JSON.parse(TSCONFIG_JSON), exclude: [RECOVERED_DIR] }, null, 2)}\n`
    : TSCONFIG_JSON;
  return [
    ['package.json', packageJson],
    ['tsconfig.json', tsconfig],
    ['.dclignore', partial ? `${DCLIGNORE}${RECOVERED_DIR}\n` : DCLIGNORE],
    ['RECOVERY.md', recoveryNotes(recovery)],
  ];
}

async function request(url: string, signal: AbortSignal): Promise<Response> {
  const response = await net.fetch(url, { signal });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
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
    const files = new Map<string, { name: string; source: Source }>();
    const put = (name: string, source: Source) => files.set(canonicalPath(name), { name, source });
    const hashes = new Set<string>();
    const skipped: string[] = [];
    for (const item of Array.isArray(entity.content) ? entity.content : []) {
      const file = toExportPath(item?.file);
      const hash = item?.hash;
      if (!file || typeof hash !== 'string' || !CONTENT_HASH.test(hash)) {
        skipped.push(String(item?.file));
        continue;
      }
      put(canonicalPath(file).startsWith('bin/') ? `${BUILD_DIR}/${file}` : file, { hash });
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

    const sourceMap = files.get(SOURCE_MAP)?.source;
    const recovery = recoverSources(
      sourceMap && 'hash' in sourceMap
        ? await fs.readFile(path.join(tmp, sourceMap.hash), 'utf8')
        : undefined,
    );
    const prefix = recovery.status === 'partial' ? `${RECOVERED_DIR}/` : '';
    for (const [file, content] of recovery.sources) put(`${prefix}${file}`, { content });
    for (const [file, content] of projectFiles(recovery)) put(file, { content });
    if (!files.has('src/index.ts')) put('src/index.ts', { content: EMPTY_ENTRY_POINT });

    const pointers = Array.isArray(entity.pointers) ? entity.pointers : [];
    const root =
      slugify(entity.metadata?.display?.title) || slugify(`scene ${pointers[0]}`) || 'scene';
    const archive = archiver('zip');
    archive.on('progress', ({ entries }) =>
      onProgress({ entityId, phase: 'zip', done: entries.processed, total: entries.total }),
    );
    for (const { name: file, source } of files.values()) {
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
    return {
      files: files.size,
      bytes: size,
      recoveredSources: recovery.sources.length,
      recovered: recovery.status,
      skipped,
    };
  } catch (error) {
    controller.abort(error);
    await fs.rm(partialPath, { force: true });
    throw error;
  } finally {
    running.delete(entityId);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Asks the user where to save the export of `entityId`, suggesting a file named after `title`,
 * then exports it from the catalyst of the app's environment. Resolves null when the dialog is
 * cancelled.
 */
export async function saveScene(
  entityId: string,
  title: unknown,
  onProgress?: (progress: SceneExportProgress) => void,
): Promise<SceneExportResult | null> {
  const outputPath = await showSaveDialog({
    defaultPath: `${slugify(title) || 'scene'}.zip`,
    filters: [{ name: 'Zip', extensions: ['zip'] }],
  });
  if (!outputPath) return null;
  return exportScene({ entityId, peerUrl: getPeerUrl(), outputPath }, onProgress);
}

/** Aborts the running export of `entityId`, if any; its `exportScene` call rejects. */
export function cancelSceneExport(entityId: string): void {
  running.get(entityId)?.abort();
}
