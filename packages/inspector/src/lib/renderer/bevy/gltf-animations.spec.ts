import type { Entity } from '@dcl/ecs';
import { createGltfAnimationsLookup, parseGltfAnimationNames } from './gltf-animations';

/** Build a minimal GLB: 12-byte header + one JSON chunk carrying `json`. */
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

describe('parseGltfAnimationNames', () => {
  it('should read the animation names from a GLB JSON chunk', () => {
    const names = parseGltfAnimationNames(
      glb({ asset: { version: '2.0' }, animations: [{ name: 'Idle' }, { name: 'Walk' }] }),
    );
    expect(names).toEqual(['Idle', 'Walk']);
  });

  it('should read a text glTF as well', () => {
    expect(parseGltfAnimationNames(gltfText({ animations: [{ name: 'Run' }] }))).toEqual(['Run']);
  });

  it('should name unnamed animations Animation<index> like the engine does', () => {
    const names = parseGltfAnimationNames(
      glb({ animations: [{}, { name: 'Jump' }, { name: '' }] }),
    );
    expect(names).toEqual(['Animation0', 'Jump', 'Animation2']);
  });

  it('should return [] for a model without animations', () => {
    expect(parseGltfAnimationNames(glb({ meshes: [] }))).toEqual([]);
  });

  it('should return [] for malformed bytes', () => {
    expect(parseGltfAnimationNames(new Uint8Array([1, 2, 3]))).toEqual([]);
    expect(parseGltfAnimationNames(new TextEncoder().encode('not json'))).toEqual([]);
  });
});

describe('createGltfAnimationsLookup', () => {
  const entity = 512 as Entity;
  let srcByEntity: Map<Entity, string>;
  let loads: string[];
  let files: Record<string, Uint8Array | null>;
  let lookup: ReturnType<typeof createGltfAnimationsLookup>;

  beforeEach(() => {
    vi.useFakeTimers();
    srcByEntity = new Map();
    loads = [];
    files = { 'assets/dog.glb': glb({ animations: [{ name: 'Idle' }, { name: 'Walk' }] }) };
    lookup = createGltfAnimationsLookup({
      getSrc: e => srcByEntity.get(e) ?? null,
      loadAsset: async src => {
        loads.push(src);
        return files[src] ?? null;
      },
      srcWaitMs: 1000,
      srcPollMs: 100,
    });
  });

  afterEach(() => {
    lookup.dispose();
    vi.useRealTimers();
  });

  it("should resolve the clip names of the entity's model file", async () => {
    srcByEntity.set(entity, 'assets/dog.glb');
    await expect(lookup.query(entity)).resolves.toEqual(['Idle', 'Walk']);
    expect(loads).toEqual(['assets/dog.glb']);
  });

  it("should wait for a just-dropped entity's GltfContainer to arrive", async () => {
    const promise = lookup.query(entity);
    await vi.advanceTimersByTimeAsync(250);
    srcByEntity.set(entity, 'assets/dog.glb');
    await vi.advanceTimersByTimeAsync(150);
    await expect(promise).resolves.toEqual(['Idle', 'Walk']);
  });

  it('should resolve [] when the entity never gets a model', async () => {
    const promise = lookup.query(entity);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).resolves.toEqual([]);
    expect(loads).toEqual([]);
  });

  it('should resolve [] when the file cannot be read', async () => {
    srcByEntity.set(entity, 'assets/missing.glb');
    await expect(lookup.query(entity)).resolves.toEqual([]);
  });

  it('should share one file read between concurrent queries of the same model', async () => {
    srcByEntity.set(entity, 'assets/dog.glb');
    srcByEntity.set(513 as Entity, 'assets/dog.glb');
    const [a, b] = await Promise.all([lookup.query(entity), lookup.query(513 as Entity)]);
    expect(a).toEqual(['Idle', 'Walk']);
    expect(b).toEqual(['Idle', 'Walk']);
    expect(loads).toEqual(['assets/dog.glb']);
  });

  it('should settle a pending query with [] on dispose', async () => {
    const promise = lookup.query(entity);
    await vi.advanceTimersByTimeAsync(50);
    lookup.dispose();
    await expect(promise).resolves.toEqual([]);
  });
});
