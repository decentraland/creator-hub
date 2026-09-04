import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';

import { NodeIO, type Document, type Texture } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

import {
  OPTIMIZE_PROGRESS_EVENT,
  type OptimizeFileResult,
  type OptimizeOptions,
  type OptimizePhase,
  type OptimizeProgress,
  type OptimizeResult,
  type OptimizeScanResult,
  type TextureCategory,
} from '/shared/types/optimizer';

import { MAIN_WINDOW_ID } from '../../mainWindow';
import { getWindow } from '../window';
import { fixGlbAlignment, patchGlbImageURIs, readGlbJson } from './glb';
import { runMeshPass } from './mesh';
import {
  CATEGORY_PRIORITY,
  classifyTextureSlot,
  compressImage,
  pixelHash,
  sanitizeFilename,
} from './textures';
import {
  OPTIMIZE_DIR,
  backupFile,
  createManifest,
  ensureDclignoreBlock,
  hasBackup,
  readManifest,
  revertFromManifest,
  stashFile,
  toPosix,
  writeManifest,
  type OptimizeManifest,
} from './backup';

// Directory (at the project root, deployed with the scene) that holds textures pulled out
// of GLBs. Not dot-prefixed: these files must ship, unlike the `.optimize/` backup.
const TEXTURES_DIR = 'optimized-textures';

// Dirs never walked for GLBs: VCS/deps, our own backup, and the externalized-texture output.
const SKIP_DIRS = new Set(['node_modules', '.git', OPTIMIZE_DIR, TEXTURES_DIR]);

// Files whose text is searched for texture names before a superseded texture is removed: a
// scene loads UI/material images directly by path, and those never show up in any GLB.
// Source and composites anywhere; JSON only at the project root (scene.json) and under src/.
// JSON beside the assets is inventory, not code — Genesis Plaza ships a manifest.json per
// model folder naming every texture, which protected 273 superseded files (86 MB) for nothing.
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.composite']);
const CODE_JSON_DIRS = new Set(['', 'src']);

function emitProgress(
  projectPath: string,
  phase: OptimizePhase,
  current: number,
  total: number,
  message: string,
  file?: string,
): void {
  const window = getWindow(MAIN_WINDOW_ID);
  if (window && !window.isDestroyed()) {
    const payload: OptimizeProgress = { path: projectPath, phase, current, total, message, file };
    window.webContents.send(OPTIMIZE_PROGRESS_EVENT, payload);
  }
}

// Recursively collect GLB files under the project, as project-relative posix paths.
async function walkGlbs(projectPath: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
        results.push(toPosix(path.relative(projectPath, full)));
      }
    }
  }
  await walk(projectPath);
  results.sort();
  return results;
}

// GLBs are read from their PATH (`io.read`), not from memory (`io.readBinary`): only the path
// form resolves sidecar textures, and a GLB that already references external images throws
// otherwise — which is what silently skipped 281 of central-plaza's 466 models. Reading from
// disk loses the chance to repair misaligned bytes first, so the repair moves into the reader.
class AlignedNodeIO extends NodeIO {
  protected override readURI(uri: string, type: 'view'): Promise<Uint8Array>;
  protected override readURI(uri: string, type: 'text'): Promise<string>;
  protected override async readURI(
    uri: string,
    type: 'view' | 'text',
  ): Promise<Uint8Array | string> {
    if (type === 'text') return super.readURI(uri, 'text');
    const view = await super.readURI(uri, 'view');
    const fixed = fixGlbAlignment(Buffer.from(view.buffer, view.byteOffset, view.byteLength));
    return new Uint8Array(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  }
}

function createIO(): NodeIO {
  return new AlignedNodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

function hasExternalImages(glbJson: any): boolean {
  return (
    Array.isArray(glbJson?.images) && glbJson.images.some((img: any) => typeof img.uri === 'string')
  );
}

// Sidecars written by earlier runs must stay unique (a re-run reusing `foo.png` would overwrite
// a texture some untouched GLB still points at) and stay deduplicable, so seed both indexes
// from what is already on disk.
async function seedFromExistingSidecars(state: RunState): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(state.texturesDirAbs);
  } catch {
    return;
  }
  for (const name of entries) {
    state.usedNames.add(name);
    if (!state.options.textures.dedup) continue;
    const abs = path.join(state.texturesDirAbs, name);
    const hash = await pixelHash(await fs.readFile(abs));
    if (hash && !state.dedupIndex.has(hash)) state.dedupIndex.set(hash, abs);
  }
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

function buildCategoryMap(document: Document): Map<Texture, TextureCategory> {
  const map = new Map<Texture, TextureCategory>();
  for (const material of document.getRoot().listMaterials()) {
    const slots: [string, Texture | null][] = [
      ['baseColorTexture', material.getBaseColorTexture()],
      ['normalTexture', material.getNormalTexture()],
      ['metallicRoughnessTexture', material.getMetallicRoughnessTexture()],
      ['occlusionTexture', material.getOcclusionTexture()],
      ['emissiveTexture', material.getEmissiveTexture()],
    ];
    for (const [slot, texture] of slots) {
      if (!texture) continue;
      const category = classifyTextureSlot(slot);
      const current = map.get(texture);
      if (!current || CATEGORY_PRIORITY[category] > CATEGORY_PRIORITY[current]) {
        map.set(texture, category);
      }
    }
  }
  return map;
}

function uniqueName(base: string, ext: string, used: Set<string>): string {
  let name = base + ext;
  let counter = 2;
  while (used.has(name)) {
    name = `${base}_${counter}${ext}`;
    counter++;
  }
  used.add(name);
  return name;
}

// Shared run-scoped state for cross-GLB texture dedup and unique filenames.
type RunState = {
  io: NodeIO;
  options: OptimizeOptions;
  projectPath: string;
  texturesDirAbs: string;
  usedNames: Set<string>;
  dedupIndex: Map<string, string>; // pixelHash -> absolute path of the canonical texture file
  // Every external texture file a processed GLB pointed at BEFORE it was rewritten. At the end
  // of the run, once every GLB is written, the ones nothing points at anymore are removed —
  // whether a sidecar replaced them or a transform dropped the texture (prune replaces a
  // solid-colour map with a material factor, leaving the file orphaned).
  externalBefore: Set<string>;
  manifest: OptimizeManifest;
  result: OptimizeResult;
};

function resolveImageUri(glbAbsPath: string, uri: string): string {
  return path.resolve(path.dirname(glbAbsPath), decodeURIComponent(uri));
}

// Pull embedded textures out to sidecar files (deduping identical pixels across all GLBs),
// returning the index->relative-URI map to patch into the written GLB.
async function externalizeTextures(
  document: Document,
  glbAbsPath: string,
  state: RunState,
): Promise<Map<number, string>> {
  const { options } = state;
  const glbDir = path.dirname(glbAbsPath);
  const categoryMap = buildCategoryMap(document);
  const textures = document.getRoot().listTextures();
  const uriMap = new Map<number, string>();

  await fs.mkdir(state.texturesDirAbs, { recursive: true });

  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i];
    const image = texture.getImage();
    if (!image) continue;

    const buffer = Buffer.from(image);
    const category = categoryMap.get(texture) ?? 'other';
    // Set when the texture was already a sidecar file of this GLB (not embedded).
    const originalAbs = texture.getURI() ? resolveImageUri(glbAbsPath, texture.getURI()) : null;

    let canonicalAbs: string | null = null;
    let hash: string | null = null;
    if (options.textures.dedup) {
      hash = await pixelHash(buffer);
      if (hash && state.dedupIndex.has(hash)) {
        canonicalAbs = state.dedupIndex.get(hash)!;
        if (canonicalAbs !== originalAbs) state.result.texturesDeduped++;
      }
    }

    if (!canonicalAbs) {
      const { data, ext } = await compressImage(
        buffer,
        category,
        texture.getMimeType(),
        options.textures,
      );
      if (originalAbs && data.length >= buffer.length) {
        // Re-encoding an existing sidecar gained nothing: keep pointing at the original rather
        // than writing a same-size copy that would only supersede it.
        canonicalAbs = originalAbs;
      } else {
        const base = sanitizeFilename(
          path.parse(texture.getURI()).name || texture.getName() || `texture_${category}`,
        );
        const finalName = uniqueName(base, ext, state.usedNames);
        canonicalAbs = path.join(state.texturesDirAbs, finalName);
        await fs.writeFile(canonicalAbs, data);
        pushUnique(
          state.manifest.createdFiles,
          toPosix(path.relative(state.projectPath, canonicalAbs)),
        );
        state.result.texturesExtracted++;
        state.result.sidecarBytes += data.length;
      }
      if (hash) state.dedupIndex.set(hash, canonicalAbs);
    }

    uriMap.set(i, toPosix(path.relative(glbDir, canonicalAbs)));
    texture.setImage(null);
  }

  return uriMap;
}

// Our own sidecars are tracked as createdFiles (deleted on revert); never also stash them as
// removed files, or revert would fight itself over the same path.
function isInsideTexturesDir(state: RunState, abs: string): boolean {
  const rel = path.relative(state.texturesDirAbs, abs);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Every image file any GLB in the project still points at, as absolute paths.
async function collectReferencedImages(projectPath: string, glbs: string[]): Promise<Set<string>> {
  const referenced = new Set<string>();
  for (const rel of glbs) {
    const abs = path.join(projectPath, rel);
    let json: any;
    try {
      json = readGlbJson(await fs.readFile(abs));
    } catch {
      continue;
    }
    for (const img of json?.images ?? []) {
      if (typeof img.uri === 'string') referenced.add(resolveImageUri(abs, img.uri));
    }
  }
  return referenced;
}

// Concatenated text of the scene's source, composites and JSON, so a texture name that the
// scene loads directly (UI images, material textures set in code) can be recognised.
async function collectCodeText(projectPath: string): Promise<string> {
  const chunks: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name === 'bin' || entry.name.startsWith('.')) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const relDir = toPosix(path.relative(projectPath, dir)).split('/')[0];
        if (CODE_EXTENSIONS.has(ext) || (ext === '.json' && CODE_JSON_DIRS.has(relDir))) {
          chunks.push(await fs.readFile(full, 'utf8'));
        }
      }
    }
  }
  await walk(projectPath);
  return chunks.join('\n');
}

// Move superseded original textures into the backup. Runs after every GLB is written, so the
// "still referenced" check sees the final state: a texture shared with a GLB that kept it, or
// one the scene code loads by name, stays where it is.
async function removeSupersededTextures(state: RunState, glbs: string[]): Promise<void> {
  if (state.externalBefore.size === 0) return;
  const { projectPath } = state;
  const referenced = await collectReferencedImages(projectPath, glbs);
  const codeText = await collectCodeText(projectPath);

  for (const abs of state.externalBefore) {
    if (referenced.has(abs) || isInsideTexturesDir(state, abs)) continue;
    if (codeText.includes(path.basename(abs))) continue;
    const rel = toPosix(path.relative(projectPath, abs));
    if (rel.startsWith('..')) continue;
    let bytes: number;
    try {
      bytes = (await fs.stat(abs)).size;
    } catch {
      continue;
    }
    await stashFile(projectPath, rel);
    pushUnique(state.manifest.removedFiles, rel);
    state.result.texturesRemoved++;
    state.result.removedBytes += bytes;
  }
}

// Recompress (and optionally dedup) textures while keeping them embedded in the GLB.
async function recompressEmbedded(document: Document, state: RunState): Promise<void> {
  const { options } = state;
  const categoryMap = buildCategoryMap(document);

  if (options.textures.compress) {
    for (const texture of document.getRoot().listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const category = categoryMap.get(texture) ?? 'other';
      const { data, mime } = await compressImage(
        Buffer.from(image),
        category,
        texture.getMimeType(),
        options.textures,
      );
      texture.setImage(new Uint8Array(data));
      texture.setMimeType(mime);
    }
  }

  if (options.textures.dedup) {
    await document.transform(dedup());
  }
}

async function processGlb(relPath: string, state: RunState): Promise<void> {
  const { projectPath, io, options } = state;
  const glbAbsPath = path.join(projectPath, relPath);

  const rawBuf = await fs.readFile(glbAbsPath);
  state.result.bytesBefore += rawBuf.length;

  // Snapshot the global texture counters so we can attribute this file's share.
  const extractedBefore = state.result.texturesExtracted;
  const dedupedBefore = state.result.texturesDeduped;
  const fileResult: OptimizeFileResult = {
    file: relPath,
    status: 'unchanged',
    bytesBefore: rawBuf.length,
    bytesAfter: rawBuf.length,
    texturesExtracted: 0,
    texturesDeduped: 0,
  };

  const anyWork =
    options.mesh.enabled ||
    options.textures.externalize ||
    options.textures.compress ||
    options.textures.dedup;
  if (!anyWork) {
    state.result.bytesAfter += rawBuf.length;
    state.result.files.push(fileResult);
    return;
  }

  let document: Document;
  try {
    document = await io.read(glbAbsPath);
  } catch {
    state.result.bytesAfter += rawBuf.length;
    fileResult.status = 'skipped';
    state.result.files.push(fileResult);
    return;
  }

  const glbJson = readGlbJson(rawBuf);
  for (const img of glbJson?.images ?? []) {
    if (typeof img.uri === 'string') state.externalBefore.add(resolveImageUri(glbAbsPath, img.uri));
  }

  const doMesh = options.mesh.enabled;
  // gltf-transform embeds every image when it writes a .glb, so a model whose textures already
  // live in sidecar files must be re-externalized (into TEXTURES_DIR, through the same
  // compress/dedup options) even when the user left externalize off — otherwise a mesh-only run
  // would pull its textures back inside and grow the file. The original sidecars stay on disk,
  // untouched, so revert restores a consistent model.
  const doExternalize = options.textures.externalize || hasExternalImages(glbJson);
  const doEmbedded = !doExternalize && (options.textures.compress || options.textures.dedup);

  if (doMesh) await runMeshPass(document, options.mesh);

  let uriMap: Map<number, string> | null = null;
  if (doExternalize) {
    uriMap = await externalizeTextures(document, glbAbsPath, state);
  } else if (doEmbedded) {
    await recompressEmbedded(document, state);
  }

  fileResult.texturesExtracted = state.result.texturesExtracted - extractedBefore;
  fileResult.texturesDeduped = state.result.texturesDeduped - dedupedBefore;

  await backupFile(projectPath, relPath);
  pushUnique(state.manifest.modifiedGlbs, relPath);

  await io.write(glbAbsPath, document);
  if (uriMap && uriMap.size > 0) await patchGlbImageURIs(glbAbsPath, uriMap);

  const newSize = (await fs.stat(glbAbsPath)).size;
  state.result.bytesAfter += newSize;
  state.result.glbsChanged++;
  fileResult.status = 'optimized';
  fileResult.bytesAfter = newSize;
  state.result.files.push(fileResult);
}

export async function scan(projectPath: string): Promise<OptimizeScanResult> {
  const glbs = await walkGlbs(projectPath);
  let glbBytes = 0;
  let embeddedTextureCount = 0;
  const externalTextures = new Set<string>();

  for (const rel of glbs) {
    const abs = path.join(projectPath, rel);
    try {
      glbBytes += (await fs.stat(abs)).size;
      const json = readGlbJson(await fs.readFile(abs));
      for (const img of json?.images ?? []) {
        if (typeof img.uri === 'string') externalTextures.add(resolveImageUri(abs, img.uri));
        else if (img.bufferView !== undefined) embeddedTextureCount++;
      }
    } catch {
      // ignore unreadable files in the summary
    }
  }

  let textureBytes = 0;
  for (const abs of externalTextures) {
    try {
      textureBytes += (await fs.stat(abs)).size;
    } catch {
      // a dangling reference weighs nothing
    }
  }

  return {
    glbCount: glbs.length,
    totalBytes: glbBytes + textureBytes,
    glbBytes,
    textureBytes,
    embeddedTextureCount,
    externalTextureCount: externalTextures.size,
    hasBackup: await hasBackup(projectPath),
  };
}

export async function run(projectPath: string, options: OptimizeOptions): Promise<OptimizeResult> {
  // First run is a cold start: the native/WASM tools (sharp, meshoptimizer, oxipng) load and
  // compile here, which takes a moment before any file is touched. Tell the user so it doesn't
  // look frozen — the message is shown on the modal's progress bar.
  emitProgress(projectPath, 'prepare', 0, 0, 'Preparing optimizer (loading tools)…');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;

  const glbs = await walkGlbs(projectPath);
  const total = glbs.length;

  // Re-runs merge into the previous manifest: revert must undo EVERY run since the last revert,
  // and `backupFile` already keeps the first (pristine) copy of a GLB across runs.
  const previousManifest = await readManifest(projectPath);

  const state: RunState = {
    io: createIO(),
    options,
    projectPath,
    texturesDirAbs: path.join(projectPath, TEXTURES_DIR),
    usedNames: new Set<string>(),
    dedupIndex: new Map<string, string>(),
    externalBefore: new Set<string>(),
    manifest: previousManifest ?? createManifest(),
    result: {
      glbsProcessed: 0,
      glbsChanged: 0,
      texturesExtracted: 0,
      texturesDeduped: 0,
      texturesRemoved: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      sidecarBytes: 0,
      removedBytes: 0,
      files: [],
    },
  };

  // Draco encoding/decoding happens at write/read time via these registered deps. Loaded
  // lazily (WASM) only when the user opts into Draco compression — the slowest tool to init,
  // so it gets its own message.
  if (options.mesh.enabled && options.mesh.compression === 'draco') {
    emitProgress(projectPath, 'prepare', 0, total, 'Loading the Draco compressor…');
    const ns = await import('draco3dgltf');
    const draco3d = (ns as any).default ?? ns;
    state.io.registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  }

  emitProgress(projectPath, 'backup', 0, total, 'Preparing backup…');
  await ensureDclignoreBlock(projectPath);
  await seedFromExistingSidecars(state);

  for (let i = 0; i < glbs.length; i++) {
    const rel = glbs[i];
    emitProgress(projectPath, 'textures', i, total, `Optimizing ${rel}`, rel);
    try {
      await processGlb(rel, state);
    } catch (error: any) {
      emitProgress(projectPath, 'error', i, total, `Failed on ${rel}: ${error.message}`, rel);
    }
    state.result.glbsProcessed++;
  }

  emitProgress(projectPath, 'write', total, total, 'Removing superseded textures…');
  await removeSupersededTextures(state, glbs);
  state.result.bytesBefore += state.result.removedBytes;
  state.result.bytesAfter += state.result.sidecarBytes;

  emitProgress(projectPath, 'write', total, total, 'Writing manifest…');
  await writeManifest(projectPath, state.manifest);

  emitProgress(projectPath, 'done', total, total, 'Optimization complete');
  return state.result;
}

export async function revert(projectPath: string): Promise<{ restored: number }> {
  const manifest = await readManifest(projectPath);
  if (!manifest) return { restored: 0 };
  const restored = await revertFromManifest(projectPath, manifest);
  // Remove the externalized-textures dir if the reverted files left it empty (rmdir only
  // succeeds on an empty dir, so a shared/hand-added dir is preserved).
  await fs.rmdir(path.join(projectPath, TEXTURES_DIR)).catch(() => {});
  return { restored };
}
