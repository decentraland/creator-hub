import { validateTextures, fixGlbTextures, nextPowerOfTwo } from '@dcl/gltf-validator-ts';

export type {
  TextureImageInfo,
  TextureIssue,
  TextureValidationResult,
} from '@dcl/gltf-validator-ts';

export { isPowerOfTwo, nextPowerOfTwo } from '@dcl/gltf-validator-ts';

import type {
  TextureImageInfo,
  TextureIssue,
  TextureValidationResult,
} from '@dcl/gltf-validator-ts';

export async function validateTexturesInModel(
  fileBuffer: ArrayBuffer,
  fileName: string,
  getExternalResource: (uri: string) => Promise<Uint8Array>,
): Promise<TextureValidationResult> {
  const isGlb = fileName.toLowerCase().endsWith('.glb');
  return validateTextures(new Uint8Array(fileBuffer), {
    format: isGlb ? 'glb' : 'gltf',
    externalResourceFunction: getExternalResource,
  });
}

async function resizeImageToPowerOfTwo(
  imageData: Uint8Array,
  mimeType: string,
  targetWidth: number,
  targetHeight: number,
): Promise<Uint8Array> {
  const blob = new Blob([imageData.buffer as ArrayBuffer], { type: mimeType || 'image/png' });
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const outputType = mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const outputBlob = await canvas.convertToBlob({ type: outputType });
  return new Uint8Array(await outputBlob.arrayBuffer());
}

export async function fixGlbEmbeddedImages(
  fileBuffer: ArrayBuffer,
  images: TextureImageInfo[],
  issues: TextureIssue[],
): Promise<ArrayBuffer> {
  return fixGlbTextures(new Uint8Array(fileBuffer), images, issues, resizeImageToPowerOfTwo);
}

export async function fixExternalImages(
  images: TextureImageInfo[],
  issues: TextureIssue[],
  externalFiles: Map<string, { blob: File; name: string; extension: string }>,
): Promise<Map<string, File>> {
  const fixedFiles = new Map<string, File>();
  const affectedIndices = new Set<number>();

  for (const issue of issues) {
    if (issue.type === 'not-power-of-two' || issue.type === 'not-square') {
      issue.imageIndices?.forEach(idx => affectedIndices.add(idx));
    }
  }

  for (const idx of affectedIndices) {
    const img = images.find(i => i.imageIndex === idx);
    if (!img) continue;

    const fileEntry = externalFiles.get(img.name);
    if (!fileEntry) continue;

    const targetSize = Math.max(nextPowerOfTwo(img.width), nextPowerOfTwo(img.height));
    const buffer = await fileEntry.blob.arrayBuffer();
    const mimeType = fileEntry.blob.type || 'image/png';

    const resized = await resizeImageToPowerOfTwo(
      new Uint8Array(buffer),
      mimeType,
      targetSize,
      targetSize,
    );

    fixedFiles.set(
      img.name,
      new File([resized.buffer as ArrayBuffer], fileEntry.blob.name, { type: fileEntry.blob.type }),
    );
  }

  return fixedFiles;
}
