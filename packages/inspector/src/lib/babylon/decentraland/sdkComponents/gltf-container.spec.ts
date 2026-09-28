import * as BABYLON from '@babylonjs/core';
import type { Entity, IEngine } from '@dcl/ecs';
import { Transform, Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import type { SceneContext } from '../SceneContext';
import { EcsEntity } from '../EcsEntity';
import * as fns from './gltf-container';

const getContext = () => ({
  componentPutOperations: {
    [Transform.componentId]: vi.fn(),
  },
  loadableScene: {
    id: 'some-id',
  },
  engine: {
    RootEntity: 0 as Entity,
  },
});

type MockSceneContextType = SceneContext & { deref: () => ReturnType<typeof getContext> };

const getGltfContainer = () => ({
  setEnabled: vi.fn(),
  parent: 'some-parent',
  dispose: vi.fn(),
});

describe('gltf-container setup', () => {
  let engine: IEngine;
  let entity: EcsEntity;
  let entityId: Entity;
  let mockedContext: ReturnType<typeof getContext>;
  let context: MockSceneContextType;
  let scene: BABYLON.Scene;
  let gltfContainer: ReturnType<typeof getGltfContainer>;

  beforeEach(() => {
    vi.restoreAllMocks();
    engine = Engine();
    entityId = 512 as Entity;
    mockedContext = getContext();
    context = { deref: () => mockedContext } as unknown as MockSceneContextType;
    scene = new BABYLON.Scene(
      new BABYLON.NullEngine({
        renderWidth: 512,
        renderHeight: 256,
        textureSize: 512,
        deterministicLockstep: true,
        lockstepMaxSteps: 4,
      }),
    );
    entity = new EcsEntity(entityId, context, scene);
    gltfContainer = getGltfContainer();
  });

  it('putGltfContainerComponent: should update entity correctly with LastWriteWinElementSet component', () => {
    const Transform = components.Transform(engine);
    Transform.create(entityId);
    entity.ecsComponentValues.gltfContainer = undefined;
    fns.putGltfContainerComponent(entity, Transform);
    expect(entity.ecsComponentValues.gltfContainer).toStrictEqual(
      Transform.getOrNull(entity.entityId),
    );
  });

  it('putGltfContainerComponent: should do nothing if component type is not LastWriteWinElementSet', () => {
    const Transform = components.Transform(engine);
    (Transform as any).componentType = 'other-type';
    (entity.ecsComponentValues.gltfContainer as any) = 'some-value';
    fns.putGltfContainerComponent(entity, Transform);

    expect(entity.ecsComponentValues.gltfContainer).toBe('some-value');
  });

  it('removeGltf: should remove gltfContainer correctly', () => {
    (entity.gltfContainer as any) = gltfContainer;
    fns.removeGltf(entity);

    expect(gltfContainer.setEnabled).toBeCalledWith(false);
    expect(gltfContainer.parent).toBe(null);
    expect(gltfContainer.dispose).toBeCalled();
    expect(entity.gltfContainer).toBeUndefined();
  });

  it('removeGltf: should return early if context is missing', () => {
    (entity.gltfContainer as any) = gltfContainer;
    entity.context.deref = vi.fn(() => null);
    fns.removeGltf(entity);

    expect(entity.gltfContainer).toBe(gltfContainer);
  });

  it('removeGltf: should not run removal actions if gltfContainer is missing on entity', () => {
    (entity.gltfContainer as any) = undefined;
    entity.context.deref = vi.fn(() => null);
    fns.removeGltf(entity);

    expect(gltfContainer.setEnabled).not.toBeCalled();
    expect(gltfContainer.dispose).not.toBeCalled();
    expect(entity.gltfContainer).toBe(undefined);
  });
});

// The optimizer parks deduped textures in a shared sidecar folder, so an optimized GLB reaches
// them through `../` URIs. Babylon rejects those in `GLTFLoader._ValidateUri` unless the
// DCL_file_resolver extension claims them first, and the data layer keys files by their
// collapsed project-relative path.
describe('gltf-container sidecar texture resolution', () => {
  const GLB_DIR = 'assets/models/table';
  const TEXTURE_PATH = 'assets/optimized-textures/wood.png';

  let scene: BABYLON.Scene;
  let getFile: ReturnType<typeof vi.fn>;

  function buildGlb(imageUri: string): Uint8Array {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
    const bin = new Uint8Array(positions.byteLength + uvs.byteLength);
    bin.set(new Uint8Array(positions.buffer), 0);
    bin.set(new Uint8Array(uvs.buffer), positions.byteLength);

    const gltf = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      textures: [{ source: 0 }],
      images: [{ uri: imageUri, mimeType: 'image/png' }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
        { buffer: 0, byteOffset: positions.byteLength, byteLength: uvs.byteLength },
      ],
      buffers: [{ byteLength: bin.byteLength }],
    };

    const pad = (bytes: Uint8Array, filler: number) => {
      const padding = (4 - (bytes.byteLength % 4)) % 4;
      if (!padding) return bytes;
      const padded = new Uint8Array(bytes.byteLength + padding);
      padded.set(bytes);
      padded.fill(filler, bytes.byteLength);
      return padded;
    };

    const json = pad(new TextEncoder().encode(JSON.stringify(gltf)), 0x20);
    const binChunk = pad(bin, 0);
    const total = 12 + 8 + json.byteLength + 8 + binChunk.byteLength;
    const glb = new Uint8Array(total);
    const view = new DataView(glb.buffer);
    view.setUint32(0, 0x46546c67, true); // 'glTF'
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, json.byteLength, true);
    view.setUint32(16, 0x4e4f534a, true); // 'JSON'
    glb.set(json, 20);
    view.setUint32(20 + json.byteLength, binChunk.byteLength, true);
    view.setUint32(24 + json.byteLength, 0x004e4942, true); // 'BIN'
    glb.set(binChunk, 28 + json.byteLength);
    return glb;
  }

  function load(imageUri: string) {
    const file = new File(
      [buildGlb(imageUri) as BlobPart],
      `${GLB_DIR}/table.glb?sceneId=some-id&base=${encodeURIComponent(GLB_DIR)}`,
    );

    return new Promise<void>((resolve, reject) => {
      fns.loadAssetContainer(
        file,
        scene,
        () => resolve(),
        undefined,
        (_scene, message) => reject(new Error(message)),
        '.glb',
      );
    });
  }

  beforeEach(async () => {
    scene = new BABYLON.Scene(new BABYLON.NullEngine());
    getFile = vi.fn(async (path: string) =>
      path === TEXTURE_PATH ? new Uint8Array([1, 2, 3, 4]) : null,
    );

    // `loadGltf` is what seeds the module's scene-context ref that the file resolver reads;
    // this call bails as soon as the seed GLB comes back missing.
    const seedEntity = new EcsEntity(
      1024 as Entity,
      {
        deref: () => ({ ...getContext(), scene, getFile }),
      } as unknown as MockSceneContextType,
      scene,
    );
    seedEntity.getRoot = () => 0 as unknown as ReturnType<EcsEntity['getRoot']>;
    await fns.loadGltf(seedEntity, 'seed.glb');
  });

  it('resolves a sidecar texture reached through `../`', async () => {
    await expect(load('../../optimized-textures/wood.png')).resolves.toBeUndefined();
    expect(getFile).toHaveBeenCalledWith(TEXTURE_PATH);
  });

  it('resolves a texture sitting beside the model', async () => {
    getFile.mockImplementation(async (path: string) =>
      path === `${GLB_DIR}/wood.png` ? new Uint8Array([1, 2, 3, 4]) : null,
    );
    await expect(load('wood.png')).resolves.toBeUndefined();
    expect(getFile).toHaveBeenCalledWith(`${GLB_DIR}/wood.png`);
  });
});
