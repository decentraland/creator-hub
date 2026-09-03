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
  // Merge compatible meshes/primitives to cut draw calls. Structural; opt-in.
  join: boolean;
  // Lossy polygon reduction via the meshoptimizer simplifier. Opt-in.
  simplify: boolean;
  // Target triangle ratio (0..1) and max error (0..1) for simplify.
  simplifyRatio: number;
  simplifyError: number;
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

export type OptimizeScanResult = {
  glbCount: number;
  totalBytes: number;
  embeddedTextureCount: number;
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

export type OptimizeResult = {
  glbsProcessed: number;
  glbsChanged: number;
  texturesExtracted: number;
  texturesDeduped: number;
  bytesBefore: number;
  bytesAfter: number;
  files: OptimizeFileResult[];
};

export type OptimizePhase = 'prepare' | 'backup' | 'mesh' | 'textures' | 'write' | 'done' | 'error';

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

export const DEFAULT_OPTIMIZE_OPTIONS: OptimizeOptions = {
  mesh: {
    enabled: true,
    join: false,
    simplify: false,
    simplifyRatio: 0.75,
    simplifyError: 0.01,
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
