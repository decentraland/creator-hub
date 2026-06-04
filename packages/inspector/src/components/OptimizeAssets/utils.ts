import { DIRECTORY } from '../../lib/data-layer/host/fs-utils';
import type { DataLayerRpcClient } from '../../lib/data-layer/types';
import type { TextureType, CompressionSettings, OptimizableAsset, OptimizationResult } from './types';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

const SUFFIX_REGEX = /_(baseColor|normal|orm|metallicRoughness|occlusion|emissive)\./i;

const FORMAT_MIME: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function isImageFile(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function classifyTexture(filename: string): TextureType {
  const match = filename.match(SUFFIX_REGEX);
  if (!match) return 'other';
  const suffix = match[1].toLowerCase();
  if (suffix === 'metallicroughness' || suffix === 'occlusion') return 'orm';
  if (suffix === 'basecolor') return 'baseColor';
  return suffix as TextureType;
}

export function getMaxHeight(type: TextureType, settings: CompressionSettings): number {
  switch (type) {
    case 'baseColor':
      return settings.baseColorSize;
    case 'normal':
      return settings.normalSize;
    case 'orm':
      return settings.ormSize;
    case 'emissive':
      return settings.emissiveSize;
    default:
      return settings.otherSize;
  }
}

function getMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return map[ext] || 'image/png';
}

export async function scanForOptimizableAssets(
  dataLayer: DataLayerRpcClient,
  ignoredPatterns: string[],
): Promise<OptimizableAsset[]> {
  const dirs = [DIRECTORY.ASSETS, 'Models'];
  const allAssets: OptimizableAsset[] = [];

  for (const dir of dirs) {
    try {
      const { files } = await dataLayer.getFilesSizes({ path: dir, ignore: ignoredPatterns });
      for (const file of files) {
        if (isImageFile(file.path)) {
          allAssets.push({
            path: file.path,
            size: file.size,
            type: classifyTexture(file.path),
          });
        }
      }
    } catch {
      // Directory may not exist
    }
  }

  allAssets.sort((a, b) => b.size - a.size);
  return allAssets;
}

async function compressImage(
  content: Uint8Array,
  sourcePath: string,
  maxHeight: number,
  quality: number,
  outputFormat: string,
): Promise<Uint8Array> {
  const sourceMime = getMimeType(sourcePath);
  const blob = new Blob([content], { type: sourceMime });
  const bitmap = await createImageBitmap(blob);

  let targetWidth = bitmap.width;
  let targetHeight = bitmap.height;

  if (targetHeight > maxHeight) {
    const scale = maxHeight / targetHeight;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = maxHeight;
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const outputMime = FORMAT_MIME[outputFormat] || 'image/png';
  const qualityNormalized = outputMime === 'image/png' ? undefined : quality / 100;
  const outputBlob = await canvas.convertToBlob({ type: outputMime, quality: qualityNormalized });
  const arrayBuffer = await outputBlob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function optimizeAsset(
  dataLayer: DataLayerRpcClient,
  asset: OptimizableAsset,
  settings: CompressionSettings,
): Promise<OptimizationResult> {
  const maxHeight = getMaxHeight(asset.type, settings);

  try {
    const { content } = await dataLayer.getFile({ path: asset.path });
    const optimized = await compressImage(
      content,
      asset.path,
      maxHeight,
      settings.quality,
      settings.format,
    );

    if (optimized.length >= content.length) {
      return {
        path: asset.path,
        originalSize: asset.size,
        optimizedSize: asset.size,
        skipped: true,
      };
    }

    let outputPath = asset.path;
    const currentExt = asset.path.split('.').pop()?.toLowerCase() || '';
    const targetExt = settings.format === 'jpeg' ? 'jpg' : settings.format;
    if (currentExt !== targetExt) {
      outputPath = asset.path.replace(/\.[^.]+$/, `.${targetExt}`);
    }

    await dataLayer.saveFile({ path: outputPath, content: optimized });

    if (outputPath !== asset.path) {
      await dataLayer.removeFiles({ filePaths: [asset.path] });
    }

    return {
      path: outputPath,
      originalSize: asset.size,
      optimizedSize: optimized.length,
      skipped: false,
    };
  } catch (error) {
    console.error(`Failed to optimize ${asset.path}:`, error);
    return {
      path: asset.path,
      originalSize: asset.size,
      optimizedSize: asset.size,
      skipped: true,
    };
  }
}
