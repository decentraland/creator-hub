// Types shared across main/preload/renderer for the model-optimization ("Optimize" tab)
// feature. Kept here because preload subscribes to the progress channel and cannot import
// from main, so the event name and payload shape need a single home (mirrors PREVIEW_PROGRESS_EVENT).

export type TextureFormat = 'png' | 'jpeg' | 'webp';
export type DenoiseLevel = 'off' | 'light' | 'medium' | 'strong';

export type TextureCategory = 'baseColor' | 'normal' | 'orm' | 'emissive' | 'other';

export type TextureSizes = Record<TextureCategory, number>;

// Geometry compression applied after the base mesh pass. Everything except 'none'
// adds a glTF extension the TARGET RUNTIME must support, or the model won't load
// in-world — hence opt-in and clearly flagged in the UI.
//   quantize -> KHR_mesh_quantization
//   meshopt  -> EXT_meshopt_compression (includes quantization)
//   draco    -> KHR_draco_mesh_compression
export type GeometryCompression = 'none' | 'quantize' | 'meshopt' | 'draco';

export type MeshOptions = {
  // Master toggle for the lossless mesh cleanup pass (prune + dedup + weld + reorder).
  enabled: boolean;
  // Extension-based geometry compression (opt-in; needs runtime support).
  compression: GeometryCompression;
};

export type TextureOptions = {
  compress: boolean;
  dedup: boolean;
  // Pull embedded textures out to sidecar files. Required for cross-GLB dedup.
  externalize: boolean;
  sizes: TextureSizes;
  format: TextureFormat;
  quality: number; // 1..100 — JPEG/WebP only; PNG uses lossless oxipng
  denoise: DenoiseLevel;
};

export type OptimizeOptions = {
  mesh: MeshOptions;
  textures: TextureOptions;
};

// totalBytes covers the models AND the texture files they reference, so a scene whose textures
// already live beside its GLBs isn't reported as a fraction of its real weight.
export type OptimizeScanResult = {
  glbCount: number;
  totalBytes: number;
  glbBytes: number;
  textureBytes: number; // external texture files referenced by the GLBs, each counted once
  embeddedTextureCount: number;
  externalTextureCount: number;
  hasBackup: boolean; // a prior run's backup exists, so revert is available
};

// Per-GLB outcome, for the verbose (expandable) results view.
export type OptimizeFileResult = {
  file: string; // project-relative path
  status: 'optimized' | 'unchanged' | 'skipped';
  bytesBefore: number;
  bytesAfter: number;
  texturesExtracted: number;
  texturesDeduped: number;
};

// bytesBefore/bytesAfter are the scene's model+texture footprint by the SAME definition the scan
// uses (every GLB + each external texture file they reference), measured before and after the run.
// Counting only GLBs made a run that moved textures out of the models look like an 85% saving
// when the deploy folder had actually grown; counting only the textures the run touched made the
// result disagree with the scan line shown right under it.
export type OptimizeResult = {
  glbsProcessed: number;
  glbsChanged: number;
  texturesExtracted: number;
  texturesDeduped: number;
  // Original external textures superseded by a sidecar and moved into the backup.
  texturesRemoved: number;
  bytesBefore: number;
  bytesAfter: number;
  sidecarBytes: number;
  removedBytes: number;
  files: OptimizeFileResult[];
};

export type OptimizePhase =
  | 'install'
  | 'prepare'
  | 'backup'
  | 'mesh'
  | 'textures'
  | 'write'
  | 'done'
  | 'error';

// Progress pushed from main to the renderer during a run.
export const OPTIMIZE_PROGRESS_EVENT = 'optimizer.progress';

export type OptimizeProgress = {
  path: string; // project path, so a subscriber can filter to its own run
  phase: OptimizePhase;
  file?: string;
  current: number;
  total: number;
  message: string;
};

// The toolchain is downloaded on first use (see main's optimizer/tools.ts), pinned to exact
// versions; the renderer shows this list on the consent screen before anything is fetched.
export type OptimizeToolsStatus = 'missing' | 'ready';

export type OptimizeToolInfo = {
  pkg: string;
  name: string;
  version: string;
  purposeKey: 'sharp' | 'gltf' | 'oxipng' | 'meshopt' | 'draco';
  npm: string; // npm page of the exact version
  source: string; // upstream release page
};

export type OptimizeToolsInfo = {
  status: OptimizeToolsStatus;
  tools: OptimizeToolInfo[];
  downloadSizeMb: number;
};

// Host ⇄ worker contract: the job goes to the worker in OPTIMIZER_JOB, messages come back as
// one JSON object per stdout line.
export type OptimizeWorkerJob = { command: 'run'; projectPath: string; options: OptimizeOptions };

export type OptimizeWorkerMessage =
  | { type: 'progress'; progress: Omit<OptimizeProgress, 'path'> }
  | { type: 'result'; result: OptimizeResult }
  | { type: 'error'; message: string };

export const DEFAULT_OPTIMIZE_OPTIONS: OptimizeOptions = {
  mesh: {
    enabled: true,
    compression: 'none',
  },
  textures: {
    compress: true,
    dedup: true,
    externalize: true,
    sizes: { baseColor: 1024, normal: 1024, orm: 512, emissive: 512, other: 512 },
    format: 'png',
    quality: 85,
    denoise: 'off',
  },
};
