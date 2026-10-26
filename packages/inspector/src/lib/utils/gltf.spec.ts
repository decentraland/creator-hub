import { getGltfResourceUris, parseGltfJson } from './gltf';

function glb(json: unknown): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(text.byteLength / 4) * 4).fill(0x20);
  padded.set(text);
  const out = new Uint8Array(12 + 8 + padded.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, padded.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(padded, 20);
  return out;
}

const gltfText = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));

describe('lib/utils/gltf', () => {
  describe('parseGltfJson', () => {
    it('should read the JSON chunk of a GLB and the text of a glTF', () => {
      expect(parseGltfJson(glb({ asset: { version: '2.0' } }))).toEqual({
        asset: { version: '2.0' },
      });
      expect(parseGltfJson(gltfText({ asset: { version: '2.0' } }))).toEqual({
        asset: { version: '2.0' },
      });
    });
    it('should return null for malformed content', () => {
      expect(parseGltfJson(new TextEncoder().encode('not json'))).toBeNull();
      expect(parseGltfJson(new TextEncoder().encode('42'))).toBeNull();
    });
  });

  describe('getGltfResourceUris', () => {
    const json = {
      buffers: [{ uri: 'model.bin' }, { byteLength: 4 }],
      images: [
        { uri: '../textures/wood%20dark.png' },
        { uri: 'data:image/png;base64,AAAA' },
        { uri: 'https://example.com/a.png' },
        { bufferView: 0 },
      ],
    };
    it('should list the relative buffers and images of a glTF, decoded', () => {
      expect(getGltfResourceUris(gltfText(json))).toEqual([
        'model.bin',
        '../textures/wood dark.png',
      ]);
    });
    it('should list the external images of a GLB', () => {
      expect(getGltfResourceUris(glb(json))).toEqual(['model.bin', '../textures/wood dark.png']);
    });
    it('should return no resources for a malformed file', () => {
      expect(getGltfResourceUris(new Uint8Array([1, 2, 3]))).toEqual([]);
    });
  });
});
