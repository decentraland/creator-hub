const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_JSON = 0x4e4f534a;
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;

type GltfJson = Record<string, unknown>;

function readGlbJsonChunk(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES) return null;
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  const chunkLength = view.getUint32(GLB_HEADER_BYTES, true);
  const chunkType = view.getUint32(GLB_HEADER_BYTES + 4, true);
  if (chunkType !== GLB_CHUNK_JSON) return null;
  const start = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES;
  const end = Math.min(start + chunkLength, bytes.byteLength);
  return new TextDecoder().decode(bytes.subarray(start, end));
}

/** The JSON document of a GLB or glTF file; null when it is malformed. */
export function parseGltfJson(bytes: Uint8Array): GltfJson | null {
  const text = readGlbJsonChunk(bytes) ?? new TextDecoder().decode(bytes);
  try {
    const json: unknown = JSON.parse(text);
    return json && typeof json === 'object' && !Array.isArray(json) ? (json as GltfJson) : null;
  } catch {
    return null;
  }
}

function decodeUri(uri: string) {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function getUris(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(item => (item as { uri?: unknown } | null)?.uri)
    .filter((uri): uri is string => typeof uri === 'string' && !/^(data|https?):/i.test(uri));
}

/** The files a GLB or glTF file loads by relative URI (buffers and images), decoded. */
export function getGltfResourceUris(bytes: Uint8Array): string[] {
  const gltf = parseGltfJson(bytes);
  if (!gltf) return [];
  return [...getUris(gltf.buffers), ...getUris(gltf.images)].filter(Boolean).map(decodeUri);
}
