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
  toPosix,
  writeManifest,
  type OptimizeManifest,
} from './backup';

// Directory (at the project root, deployed with the scene) that holds textures pulled out
// of GLBs. Not dot-prefixed: these files must ship, unlike the `.optimize/` backup.
const TEXTURES_DIR = 'optimized-textures';

// Dirs never walked for GLBs: VCS/deps, our own backup, and the externalized-texture output.
const SKIP_DIRS = new Set(['node_modules', '.git', OPTIMIZE_DIR, TEXTURES_DIR]);

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

function createIO(): NodeIO {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
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
  manifest: OptimizeManifest;
  result: OptimizeResult;
};

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

    let canonicalAbs: string | null = null;
    let hash: string | null = null;
    if (options.textures.dedup) {
      hash = await pixelHash(buffer);
      if (hash && state.dedupIndex.has(hash)) {
        canonicalAbs = state.dedupIndex.get(hash)!;
        state.result.texturesDeduped++;
      }
    }

    if (!canonicalAbs) {
      const { data, ext } = await compressImage(
        buffer,
        category,
        texture.getMimeType(),
        options.textures,
      );
      const base = sanitizeFilename(texture.getName() || `texture_${category}`);
      const finalName = uniqueName(base, ext, state.usedNames);
      canonicalAbs = path.join(state.texturesDirAbs, finalName);
      await fs.writeFile(canonicalAbs, data);
      state.manifest.createdFiles.push(toPosix(path.relative(state.projectPath, canonicalAbs)));
      state.result.texturesExtracted++;
      if (hash) state.dedupIndex.set(hash, canonicalAbs);
    }

    uriMap.set(i, toPosix(path.relative(glbDir, canonicalAbs)));
    texture.setImage(null);
  }

  return uriMap;
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

  let document: Document;
  try {
    document = await io.readBinary(fixGlbAlignment(rawBuf));
  } catch {
    // Unreadable or already-externalized textures — leave untouched.
    state.result.bytesAfter += rawBuf.length;
    fileResult.status = 'skipped';
    state.result.files.push(fileResult);
    return;
  }

  const doMesh = options.mesh.enabled;
  const doExternalize = options.textures.externalize;
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

  const changed = doMesh || doExternalize || doEmbedded;
  if (!changed) {
    state.result.bytesAfter += rawBuf.length;
    state.result.files.push(fileResult);
    return;
  }

  await backupFile(projectPath, relPath);
  state.manifest.modifiedGlbs.push(relPath);

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
  let totalBytes = 0;
  let embeddedTextureCount = 0;

  for (const rel of glbs) {
    const abs = path.join(projectPath, rel);
    try {
      totalBytes += (await fs.stat(abs)).size;
      const json = readGlbJson(await fs.readFile(abs));
      if (json?.images) {
        embeddedTextureCount += json.images.filter(
          (img: { bufferView?: number; uri?: string }) => img.bufferView !== undefined && !img.uri,
        ).length;
      }
    } catch {
      // ignore unreadable files in the summary
    }
  }

  return {
    glbCount: glbs.length,
    totalBytes,
    embeddedTextureCount,
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

  const state: RunState = {
    io: createIO(),
    options,
    projectPath,
    texturesDirAbs: path.join(projectPath, TEXTURES_DIR),
    usedNames: new Set<string>(),
    dedupIndex: new Map<string, string>(),
    manifest: createManifest(),
    result: {
      glbsProcessed: 0,
      glbsChanged: 0,
      texturesExtracted: 0,
      texturesDeduped: 0,
      bytesBefore: 0,
      bytesAfter: 0,
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
