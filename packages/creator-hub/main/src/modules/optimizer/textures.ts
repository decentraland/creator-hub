import crypto from 'node:crypto';
import sharp from 'sharp';
import oxipng from '@wasm-codecs/oxipng';

import type {
  DenoiseLevel,
  TextureCategory,
  TextureFormat,
  TextureOptions,
} from '/shared/types/optimizer';

// Texture classification + compression, adapted from decentraland/SceneOptimizer
// (utils.js + compress.js). PNG output is optimized losslessly with oxipng; JPEG/WebP go
// through sharp with the quality slider. sharp handles all resizing/denoising.

export const CATEGORY_PRIORITY: Record<TextureCategory, number> = {
  baseColor: 5,
  normal: 4,
  orm: 3,
  emissive: 2,
  other: 1,
};

const SLOT_MAP: Record<string, TextureCategory> = {
  baseColorTexture: 'baseColor',
  metallicRoughnessTexture: 'orm',
  normalTexture: 'normal',
  occlusionTexture: 'orm',
  emissiveTexture: 'emissive',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const FORMAT_TO_EXT: Record<TextureFormat, string> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
};

const FORMAT_TO_MIME: Record<TextureFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const DENOISE_SETTINGS: Record<
  DenoiseLevel,
  { median: number; sharpen?: { sigma: number } } | null
> = {
  off: null,
  light: { median: 3, sharpen: { sigma: 0.5 } },
  medium: { median: 3, sharpen: { sigma: 0.8 } },
  strong: { median: 5, sharpen: { sigma: 1.0 } },
};

export function classifyTextureSlot(slotName: string): TextureCategory {
  return SLOT_MAP[slotName] ?? 'other';
}

export function mimeToExtension(mimeType: string | null): string {
  return (mimeType && MIME_TO_EXT[mimeType]) || '.png';
}

export function extensionForFormat(format: TextureFormat): string {
  return FORMAT_TO_EXT[format];
}

export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- control chars are intentionally stripped from filenames
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

// SHA-256 of the decoded (raw) pixels, so two textures with identical content but different
// encodings/names still dedup. Returns null when sharp can't decode (e.g. KTX2/Basis).
export async function pixelHash(input: Buffer): Promise<string | null> {
  try {
    const raw = await sharp(input).raw().toBuffer();
    return crypto.createHash('sha256').update(raw).digest('hex');
  } catch {
    return null;
  }
}

export type CompressResult = { data: Buffer; ext: string; mime: string };

type SharpPipeline = ReturnType<typeof sharp>;

// Resize/re-encode a single texture. When `options.compress` is false the bytes are passed
// through unchanged (keeping their original extension) — callers still use this to get a
// consistent { data, ext, mime } shape.
export async function compressImage(
  input: Buffer,
  category: TextureCategory,
  sourceMime: string | null,
  options: TextureOptions,
): Promise<CompressResult> {
  if (!options.compress) {
    return { data: input, ext: mimeToExtension(sourceMime), mime: sourceMime || 'image/png' };
  }

  const format = options.format;
  const maxHeight = options.sizes[category] ?? options.sizes.other;
  const denoise = DENOISE_SETTINGS[options.denoise];

  let metadata: Awaited<ReturnType<SharpPipeline['metadata']>>;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    // Undecodable by sharp — leave it untouched.
    return { data: input, ext: mimeToExtension(sourceMime), mime: sourceMime || 'image/png' };
  }

  const needsResize = (metadata.height ?? 0) > maxHeight;
  const needsTransform = needsResize || !!denoise;

  const applyTransforms = (pipeline: SharpPipeline): SharpPipeline => {
    let p = pipeline;
    if (needsResize) p = p.resize(null, maxHeight, { withoutEnlargement: true });
    if (denoise) {
      p = p.median(denoise.median);
      if (denoise.sharpen) p = p.sharpen(denoise.sharpen);
    }
    return p;
  };

  if (format === 'png') {
    let pngBuffer: Buffer;
    if (needsTransform) {
      pngBuffer = await applyTransforms(sharp(input)).png().toBuffer();
    } else if (metadata.format === 'png') {
      pngBuffer = input;
    } else {
      // Non-PNG source, PNG target, no resize/denoise: still need a format conversion.
      pngBuffer = await sharp(input).png().toBuffer();
    }
    try {
      const optimized = oxipng(pngBuffer, { level: 2 });
      if (optimized.length < pngBuffer.length) pngBuffer = optimized;
    } catch {
      // oxipng failed — keep the sharp/original PNG.
    }
    return { data: pngBuffer, ext: '.png', mime: 'image/png' };
  }

  let pipeline = applyTransforms(sharp(input));
  if (format === 'jpeg') {
    if (metadata.channels === 4) {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    pipeline = pipeline.jpeg({ quality: options.quality });
  } else {
    pipeline = pipeline.webp({ quality: options.quality });
  }

  const data = await pipeline.toBuffer();
  return { data, ext: FORMAT_TO_EXT[format], mime: FORMAT_TO_MIME[format] };
}
