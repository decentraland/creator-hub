export interface TextureImageInfo {
  imageIndex: number;
  width: number;
  height: number;
  name: string;
}

export interface TextureIssue {
  type: 'not-power-of-two' | 'not-square' | 'layer-size-mismatch';
  message: string;
  suggestedWidth?: number;
  suggestedHeight?: number;
  materialIndex?: number;
  imageIndices?: number[];
}

export interface TextureValidationResult {
  images: TextureImageInfo[];
  issues: TextureIssue[];
}

interface GltfJson {
  images?: Array<{
    uri?: string;
    mimeType?: string;
    bufferView?: number;
  }>;
  textures?: Array<{
    source?: number;
  }>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: {
      baseColorTexture?: { index: number };
      metallicRoughnessTexture?: { index: number };
    };
    normalTexture?: { index: number };
    occlusionTexture?: { index: number };
    emissiveTexture?: { index: number };
  }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
  }>;
  buffers?: Array<{
    uri?: string;
    byteLength: number;
  }>;
}

const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_TYPE_JSON = 0x4e4f534a;
const GLB_CHUNK_TYPE_BIN = 0x004e4942;

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let v = n - 1;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return v + 1;
}

function parseGlb(buffer: ArrayBuffer): { json: GltfJson; binChunk?: Uint8Array } {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) throw new Error('Not a valid GLB file');

  let offset = 12;
  let json: GltfJson = {};
  let binChunk: Uint8Array | undefined;

  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;

    if (chunkType === GLB_CHUNK_TYPE_JSON) {
      const decoder = new TextDecoder();
      json = JSON.parse(decoder.decode(new Uint8Array(buffer, offset, chunkLength)));
    } else if (chunkType === GLB_CHUNK_TYPE_BIN) {
      binChunk = new Uint8Array(buffer, offset, chunkLength);
    }

    offset += chunkLength;
  }

  return { json, binChunk };
}

function parseGltfJson(buffer: ArrayBuffer): GltfJson {
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(buffer));
}

async function getImageDimensions(
  data: Uint8Array,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType || 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

async function extractImageInfos(
  gltfJson: GltfJson,
  binChunk: Uint8Array | undefined,
  getExternalResource: (uri: string) => Promise<Uint8Array>,
): Promise<TextureImageInfo[]> {
  if (!gltfJson.images) return [];

  const images: TextureImageInfo[] = [];

  for (let i = 0; i < gltfJson.images.length; i++) {
    const image = gltfJson.images[i];
    let imageData: Uint8Array | null = null;
    let name = `image ${i}`;

    if (image.uri) {
      name = image.uri;
      try {
        imageData = await getExternalResource(image.uri);
      } catch {
        continue;
      }
    } else if (image.bufferView != null && binChunk && gltfJson.bufferViews) {
      const bv = gltfJson.bufferViews[image.bufferView];
      if (bv) {
        const byteOffset = bv.byteOffset ?? 0;
        imageData = binChunk.slice(byteOffset, byteOffset + bv.byteLength);
      }
    }

    if (!imageData) continue;

    try {
      const dims = await getImageDimensions(imageData, image.mimeType || 'image/png');
      images.push({ imageIndex: i, width: dims.width, height: dims.height, name });
    } catch {
      continue;
    }
  }

  return images;
}

function getImageIndexForTexture(
  gltfJson: GltfJson,
  texInfo: { index: number } | undefined,
): number | null {
  if (!texInfo || !gltfJson.textures) return null;
  const tex = gltfJson.textures[texInfo.index];
  return tex?.source ?? null;
}

function validateConstraints(gltfJson: GltfJson, images: TextureImageInfo[]): TextureIssue[] {
  const issues: TextureIssue[] = [];
  const imageMap = new Map(images.map(img => [img.imageIndex, img]));

  for (const img of images) {
    const notPow2 = !isPowerOfTwo(img.width) || !isPowerOfTwo(img.height);
    const notSquare = img.width !== img.height;

    if (notPow2) {
      issues.push({
        type: 'not-power-of-two',
        message: `"${img.name}" is ${img.width}×${img.height} (not power of two)`,
        suggestedWidth: nextPowerOfTwo(img.width),
        suggestedHeight: nextPowerOfTwo(img.height),
        imageIndices: [img.imageIndex],
      });
    }

    if (notSquare) {
      const target = Math.max(
        isPowerOfTwo(img.width) ? img.width : nextPowerOfTwo(img.width),
        isPowerOfTwo(img.height) ? img.height : nextPowerOfTwo(img.height),
      );
      issues.push({
        type: 'not-square',
        message: `"${img.name}" is ${img.width}×${img.height} (not square)`,
        suggestedWidth: target,
        suggestedHeight: target,
        imageIndices: [img.imageIndex],
      });
    }
  }

  if (gltfJson.materials && gltfJson.textures) {
    for (let mi = 0; mi < gltfJson.materials.length; mi++) {
      const material = gltfJson.materials[mi];
      const layers: { layer: string; imageIndex: number }[] = [];

      const addLayer = (layer: string, texInfo: { index: number } | undefined) => {
        const imgIdx = getImageIndexForTexture(gltfJson, texInfo);
        if (imgIdx != null) layers.push({ layer, imageIndex: imgIdx });
      };

      addLayer('baseColor', material.pbrMetallicRoughness?.baseColorTexture);
      addLayer('metallicRoughness', material.pbrMetallicRoughness?.metallicRoughnessTexture);
      addLayer('normal', material.normalTexture);
      addLayer('occlusion', material.occlusionTexture);
      addLayer('emissive', material.emissiveTexture);

      if (layers.length <= 1) continue;

      const layerDims = layers
        .map(lt => ({ ...lt, img: imageMap.get(lt.imageIndex) }))
        .filter((lt): lt is typeof lt & { img: TextureImageInfo } => !!lt.img);

      if (layerDims.length <= 1) continue;

      const first = layerDims[0].img;
      const mismatch = layerDims.some(
        d => d.img.width !== first.width || d.img.height !== first.height,
      );

      if (mismatch) {
        const materialName = material.name ?? `material ${mi}`;
        const sizes = layerDims.map(d => `${d.layer}: ${d.img.width}×${d.img.height}`).join(', ');
        issues.push({
          type: 'layer-size-mismatch',
          message: `"${materialName}" has layers with different sizes (${sizes})`,
          materialIndex: mi,
          imageIndices: layerDims.map(d => d.imageIndex),
        });
      }
    }
  }

  return issues;
}

export async function validateTexturesInModel(
  fileBuffer: ArrayBuffer,
  fileName: string,
  getExternalResource: (uri: string) => Promise<Uint8Array>,
): Promise<TextureValidationResult> {
  const isGlb = fileName.toLowerCase().endsWith('.glb');

  let gltfJson: GltfJson;
  let binChunk: Uint8Array | undefined;

  if (isGlb) {
    const parsed = parseGlb(fileBuffer);
    gltfJson = parsed.json;
    binChunk = parsed.binChunk;
  } else {
    gltfJson = parseGltfJson(fileBuffer);
  }

  if (!gltfJson.images || gltfJson.images.length === 0) {
    return { images: [], issues: [] };
  }

  const images = await extractImageInfos(gltfJson, binChunk, getExternalResource);
  const issues = validateConstraints(gltfJson, images);

  return { images, issues };
}

export function parseGltfFromBuffer(
  fileBuffer: ArrayBuffer,
  fileName: string,
): { json: GltfJson; binChunk?: Uint8Array } {
  if (fileName.toLowerCase().endsWith('.glb')) {
    return parseGlb(fileBuffer);
  }
  return { json: parseGltfJson(fileBuffer) };
}

export async function resizeImageToPowerOfTwo(
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

export async function fixGlbEmbeddedImages(
  fileBuffer: ArrayBuffer,
  images: TextureImageInfo[],
  issues: TextureIssue[],
): Promise<ArrayBuffer> {
  const { json: gltfJson, binChunk } = parseGlb(fileBuffer);
  if (!binChunk || !gltfJson.images || !gltfJson.bufferViews) return fileBuffer;

  const affectedIndices = new Set<number>();
  for (const issue of issues) {
    if (issue.type === 'not-power-of-two' || issue.type === 'not-square') {
      issue.imageIndices?.forEach(idx => affectedIndices.add(idx));
    }
  }

  // Also fix layer-size-mismatch by resizing smaller layers to match the largest
  for (const issue of issues) {
    if (issue.type === 'layer-size-mismatch') {
      issue.imageIndices?.forEach(idx => affectedIndices.add(idx));
    }
  }

  if (affectedIndices.size === 0) return fileBuffer;

  // Build new image data replacing affected images
  const imageReplacements = new Map<number, Uint8Array>();

  for (const idx of affectedIndices) {
    const image = gltfJson.images[idx];
    if (image.bufferView == null) continue;

    const bv = gltfJson.bufferViews[image.bufferView];
    if (!bv) continue;

    const byteOffset = bv.byteOffset ?? 0;
    const originalData = binChunk.slice(byteOffset, byteOffset + bv.byteLength);
    const img = images.find(i => i.imageIndex === idx);
    if (!img) continue;

    const targetSize = Math.max(nextPowerOfTwo(img.width), nextPowerOfTwo(img.height));
    if (targetSize === img.width && targetSize === img.height) continue;

    const resized = await resizeImageToPowerOfTwo(
      originalData,
      image.mimeType || 'image/png',
      targetSize,
      targetSize,
    );

    imageReplacements.set(idx, resized);
  }

  if (imageReplacements.size === 0) return fileBuffer;

  return rebuildGlb(gltfJson, binChunk, imageReplacements);
}

function rebuildGlb(
  gltfJson: GltfJson,
  originalBin: Uint8Array,
  imageReplacements: Map<number, Uint8Array>,
): ArrayBuffer {
  const json = structuredClone(gltfJson);
  if (!json.images || !json.bufferViews) {
    throw new Error('Cannot rebuild GLB without images and bufferViews');
  }

  // Collect all bin segments, replacing image data where needed
  type BinSegment = { data: Uint8Array };
  const segments: BinSegment[] = [];

  // Sort bufferViews by byteOffset to reconstruct BIN chunk in order
  const bvEntries = json.bufferViews
    .map((bv, i) => ({ bv, index: i }))
    .sort((a, b) => (a.bv.byteOffset ?? 0) - (b.bv.byteOffset ?? 0));

  // Map from image index to bufferView index
  const imageBvMap = new Map<number, number>();
  for (let i = 0; i < json.images.length; i++) {
    const img = json.images[i];
    if (img.bufferView != null) {
      imageBvMap.set(i, img.bufferView);
    }
  }

  // Reverse map: bufferView index to image index
  const bvToImage = new Map<number, number>();
  for (const [imgIdx, bvIdx] of imageBvMap) {
    bvToImage.set(bvIdx, imgIdx);
  }

  let currentOffset = 0;
  for (const { bv, index } of bvEntries) {
    const origOffset = bv.byteOffset ?? 0;
    const imgIdx = bvToImage.get(index);

    let data: Uint8Array;
    if (imgIdx != null && imageReplacements.has(imgIdx)) {
      data = imageReplacements.get(imgIdx)!;
    } else {
      data = originalBin.slice(origOffset, origOffset + bv.byteLength);
    }

    // Update bufferView
    bv.byteOffset = currentOffset;
    bv.byteLength = data.length;

    segments.push({ data });
    currentOffset += data.length;
    // Align to 4 bytes
    const padding = (4 - (currentOffset % 4)) % 4;
    if (padding > 0) {
      segments.push({ data: new Uint8Array(padding) });
      currentOffset += padding;
    }
  }

  // Update buffer length
  if (json.buffers && json.buffers.length > 0) {
    json.buffers[0].byteLength = currentOffset;
  }

  // Encode JSON chunk
  const encoder = new TextEncoder();
  let jsonStr = JSON.stringify(json);
  // Pad JSON to 4-byte alignment with spaces
  const jsonPadding = (4 - (jsonStr.length % 4)) % 4;
  jsonStr += ' '.repeat(jsonPadding);
  const jsonData = encoder.encode(jsonStr);

  // Build BIN chunk
  const binData = new Uint8Array(currentOffset);
  let writeOffset = 0;
  for (const seg of segments) {
    binData.set(seg.data, writeOffset);
    writeOffset += seg.data.length;
  }

  // Build GLB
  const totalLength = 12 + 8 + jsonData.length + 8 + binData.length;
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  const output = new Uint8Array(glb);

  // Header
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true); // version
  view.setUint32(8, totalLength, true);

  // JSON chunk
  let offset = 12;
  view.setUint32(offset, jsonData.length, true);
  view.setUint32(offset + 4, GLB_CHUNK_TYPE_JSON, true);
  output.set(jsonData, offset + 8);
  offset += 8 + jsonData.length;

  // BIN chunk
  view.setUint32(offset, binData.length, true);
  view.setUint32(offset + 4, GLB_CHUNK_TYPE_BIN, true);
  output.set(binData, offset + 8);

  return glb;
}
