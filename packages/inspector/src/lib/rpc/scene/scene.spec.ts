import { FreeCamera, NullEngine, Scene, Vector3, ScreenshotTools } from '@babylonjs/core';
import { EntityState, Name as NameEngine } from '@dcl/ecs';
import { InMemoryTransport, RPC } from '@dcl/mini-rpc';
import type { Store } from '../../../redux/store';
import { fetchLatestCatalog, getAssetById } from '../../logic/catalog';
import { getDataLayerInterface } from '../../../redux/data-layer';
import { EditorComponentNames } from '../../sdk/components';
import { SceneClient } from './client';
import { SceneServer } from './server';

// Mock the catalog / data-layer / config modules the smart-item + catalog handlers use.
// (vi.mock is hoisted above the imports by vitest regardless of position here.)
vi.mock('../../logic/catalog', () => ({ fetchLatestCatalog: vi.fn(), getAssetById: vi.fn() }));
vi.mock('../../../redux/data-layer', () => ({
  getDataLayerInterface: vi.fn(),
  refreshUndoRedoState: vi.fn(() => ({ type: 'data-layer/refreshUndoRedoState' })),
}));
vi.mock('../../logic/config', async orig => ({
  ...(await (orig as () => Promise<Record<string, unknown>>)()),
  getConfig: () => ({ contentUrl: 'https://content.test' }),
}));

describe('SceneClient RPC', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  let client: SceneClient;

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();

    parent.connect(iframe);
    iframe.connect(parent);

    client = new SceneClient(parent);
  });

  describe('when using the openFile method', () => {
    let path: string;
    let spy: any;

    beforeEach(() => {
      path = '/path/to/file.ts';
      spy = vi.spyOn(client, 'request').mockResolvedValueOnce(undefined);
    });

    afterEach(() => {
      spy.mockRestore();
    });

    it('should send the open_file request with the correct path', async () => {
      await client.openFile(path);
      expect(spy).toHaveBeenCalledWith('open_file', { path });
    });
  });

  describe('when using the getFeatureFlags method', () => {
    it('should send the get_feature_flags request and return the flags', async () => {
      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce({ flags: { 'creatorhub-inspector-scene-minimap': true } });
      const result = await client.getFeatureFlags();
      expect(spy).toHaveBeenCalledWith('get_feature_flags', {});
      expect(result).toEqual({ flags: { 'creatorhub-inspector-scene-minimap': true } });
      spy.mockRestore();
    });
  });

  describe('when using the openDirectory method', () => {
    let path: string;
    let spy: any;

    beforeEach(() => {
      path = '/path/to/directory';
      spy = vi.spyOn(client as any, 'request').mockResolvedValueOnce(undefined);
    });

    afterEach(() => {
      spy.mockRestore();
    });

    it('should send the open_directory request with the correct path', async () => {
      await client.openDirectory(path);
      expect(spy).toHaveBeenCalledWith('open_directory', { path, createIfNotExists: false });
    });
  });
});

describe('SceneServer RPC', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  let _client: SceneClient;
  let store: Store;
  let engine: NullEngine;
  let scene: Scene;
  let camera: FreeCamera;
  let renderer: any;

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();

    parent.connect(iframe);
    iframe.connect(parent);

    engine = new NullEngine();
    scene = new Scene(engine);
    camera = new FreeCamera('camera', new Vector3(0, 0, 0), scene);

    store = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      replaceReducer: vi.fn(),
    } as any as Store;

    renderer = {
      engine,
      editorCamera: {
        getCamera: () => camera,
      },
    };

    _client = new SceneClient(parent);
    new SceneServer(iframe, store, renderer);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('when testing camera position', () => {
    let x: number;
    let y: number;
    let z: number;

    beforeEach(() => {
      x = 8;
      y = 0;
      z = 8;
    });

    it('should set the camera position correctly', () => {
      camera.position.set(x, y, z);
      expect(camera.position.x).toBe(x);
      expect(camera.position.y).toBe(y);
      expect(camera.position.z).toBe(z);
    });
  });

  describe('when testing camera target', () => {
    let targetVector: Vector3;

    beforeEach(() => {
      targetVector = new Vector3(8, 0, 8);
    });

    it('should set the camera target correctly', () => {
      const spy = vi.spyOn(camera, 'setTarget');
      camera.setTarget(targetVector);
      expect(spy).toHaveBeenCalledWith(targetVector);
      spy.mockRestore();
    });
  });

  describe('when testing screenshot functionality', () => {
    let width: number;
    let height: number;
    let mockImage: string;

    beforeEach(() => {
      width = 1024;
      height = 1024;
      mockImage =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
    });

    it('should create a screenshot with the correct dimensions', async () => {
      const spy = vi.spyOn(ScreenshotTools, 'CreateScreenshotAsync');
      spy.mockResolvedValueOnce(mockImage);

      const result = await ScreenshotTools.CreateScreenshotAsync(engine, camera, {
        width,
        height,
      });

      expect(result).toBe(mockImage);
      expect(spy).toHaveBeenCalledWith(engine, camera, expect.objectContaining({ width, height }));
      spy.mockRestore();
    });
  });
});

// The renderer-agnostic handlers must work WITHOUT a Babylon renderer — this is
// what lets feature flags (and debug/tab controls) reach a non-Babylon renderer
// like Bevy. Without them the SceneMinimap flag never arrives and the minimap
// never shows under Bevy.
describe('SceneServer RPC without a renderer (non-Babylon path)', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  // A caller on the SERVER's inbound channel (the host side sends these). The
  // SceneClient uses a different RPC name, so drive the server directly.
  let host: RPC<string, any, any>;
  let store: Store;

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);

    store = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      replaceReducer: vi.fn(),
    } as any as Store;

    // No renderer argument — the Bevy path.
    new SceneServer(iframe, store);
    host = new RPC('SceneRpcInbound', parent);
  });

  afterEach(() => vi.resetAllMocks());

  it('should handle set_feature_flags and dispatch them to the store', async () => {
    await host.request('set_feature_flags', {
      flags: { 'creatorhub-inspector-scene-minimap': true },
    });
    expect(store.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { 'creatorhub-inspector-scene-minimap': true } }),
    );
  });

  it('should still handle other agnostic controls (e.g. toggle_ground_grid)', async () => {
    await host.request('toggle_ground_grid', { enabled: false });
    expect(store.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ui/toggleGroundGrid', payload: { enabled: false } }),
    );
  });

  it('get_scene_metrics: returns the scene budget, limits and out-of-bounds from the store', async () => {
    const metrics = { triangles: 1200, entities: 5, bodies: 6, materials: 3, textures: 2 };
    const limits = { triangles: 10000, entities: 200, bodies: 300, materials: 20, textures: 10 };
    vi.mocked(store.getState).mockReturnValue({
      sceneMetrics: { metrics, limits, entitiesOutOfBoundaries: [513] },
    } as any);
    const res = await host.request('get_scene_metrics', {});
    expect(res).toEqual({ metrics, limits, entitiesOutOfBoundaries: [513] });
  });
});

// Scene-graph mutations (AI assistant). The handler routes the RPC to the inspector's
// operations layer + flushes via dispatch. operations.addChild itself is covered by
// add-child.spec.ts; here we verify the SceneServer wiring: registered only when
// operations are provided, correct args, dispatch called, entity id returned.
describe('SceneServer RPC scene mutations', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  let host: RPC<string, any, any>;
  let store: Store;
  let ops: Record<string, ReturnType<typeof vi.fn>>;
  // A fake component registry: Transform exists on the entity, GltfContainer does not.
  const transform = { componentId: 1, componentName: 'core::Transform', has: () => true };
  const gltf = { componentId: 2, componentName: 'core::GltfContainer', has: () => false };

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);

    store = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      replaceReducer: vi.fn(),
    } as any as Store;

    ops = {
      addChild: vi.fn((_parent: number, _name: string) => 512),
      removeEntity: vi.fn(),
      setParent: vi.fn(),
      updateValue: vi.fn(),
      addComponent: vi.fn(),
      removeComponent: vi.fn(),
      dispatch: vi.fn().mockResolvedValue(undefined),
    };
    const engine = {
      RootEntity: 0,
      // Any non-root entity the tests reference "exists"; entity 999 is used for the invalid case.
      getEntityState: (e: number) => (e === 999 ? EntityState.Unknown : EntityState.UsedEntity),
      getComponent: (nameOrId: string | number) => {
        if (nameOrId === 'core::Transform' || nameOrId === 1) return transform;
        if (nameOrId === 'core::GltfContainer' || nameOrId === 2) return gltf;
        throw new Error('Component not found');
      },
      componentsIter: () => [transform, gltf][Symbol.iterator](),
    } as any;

    new SceneServer(iframe, store, undefined, undefined, ops as any, engine);
    host = new RPC('SceneRpcInbound', parent);
  });

  afterEach(() => vi.resetAllMocks());

  it('create_entity: adds at the root by default and returns its id', async () => {
    const result = await host.request('create_entity', { name: 'AICube' });
    expect(ops.addChild).toHaveBeenCalledWith(0, 'AICube');
    expect(ops.dispatch).toHaveBeenCalled();
    expect(result).toEqual({ entity: 512 });
  });

  it('create_entity: parents to the given id, and defaults the name', async () => {
    await host.request('create_entity', { name: 'Child', parent: 511 });
    expect(ops.addChild).toHaveBeenCalledWith(511, 'Child');
    await host.request('create_entity', {});
    expect(ops.addChild).toHaveBeenCalledWith(0, 'Entity');
  });

  it('remove_entity: removes by id and dispatches', async () => {
    const result = await host.request('remove_entity', { entity: 512 });
    expect(ops.removeEntity).toHaveBeenCalledWith(512);
    expect(ops.dispatch).toHaveBeenCalled();
    expect(result).toEqual({ entity: 512 });
  });

  it('set_parent: reparents entity under parent', async () => {
    const result = await host.request('set_parent', { entity: 512, parent: 511 });
    expect(ops.setParent).toHaveBeenCalledWith(512, 511);
    expect(result).toEqual({ entity: 512, parent: 511 });
  });

  it('rejects a mutation on a hallucinated entity id (not in the engine)', async () => {
    await expect(host.request('remove_entity', { entity: 999 })).rejects.toThrow(
      'No entity with id 999',
    );
    expect(ops.removeEntity).not.toHaveBeenCalled();
  });

  it('set_component: UPDATES an existing component (resolves short name)', async () => {
    const value = { position: { x: 1, y: 2, z: 3 } };
    const result = await host.request('set_component', {
      entity: 512,
      component: 'Transform',
      value,
    });
    expect(ops.updateValue).toHaveBeenCalledWith(transform, 512, value);
    expect(ops.addComponent).not.toHaveBeenCalled();
    expect(result).toEqual({ entity: 512, component: 'core::Transform' });
  });

  it('set_component: ADDS a component the entity lacks, by componentId', async () => {
    const value = { src: 'models/door.glb' };
    await host.request('set_component', { entity: 512, component: 'core::GltfContainer', value });
    expect(ops.addComponent).toHaveBeenCalledWith(512, 2, value);
    expect(ops.updateValue).not.toHaveBeenCalled();
  });

  it('set_component: rejects an unknown component', async () => {
    await expect(
      host.request('set_component', { entity: 512, component: 'Nope', value: {} }),
    ).rejects.toThrow('Unknown component');
  });

  it('remove_component: removes the resolved component', async () => {
    const result = await host.request('remove_component', { entity: 512, component: 'Transform' });
    expect(ops.removeComponent).toHaveBeenCalledWith(512, transform);
    expect(result).toEqual({ entity: 512, component: 'core::Transform' });
  });

  it('does NOT register mutations when operations are absent', async () => {
    const p2 = new InMemoryTransport();
    const i2 = new InMemoryTransport();
    p2.connect(i2);
    i2.connect(p2);
    new SceneServer(i2, store); // no operations → mutation methods not registered
    const host2 = new RPC<string, any, any>('SceneRpcInbound', p2);
    await expect(host2.request('create_entity', { name: 'X' })).rejects.toThrow('not implemented');
    await expect(host2.request('remove_entity', { entity: 1 })).rejects.toThrow('not implemented');
  });
});

// Catalog + script + Smart Item tools. These reach beyond the operations layer (catalog
// lookup, file import, addAsset), so we verify the SceneServer wiring with the catalog /
// data-layer / config modules mocked.
describe('SceneServer RPC catalog + script + smart item', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  let host: RPC<string, any, any>;
  let store: Store;
  let ops: Record<string, ReturnType<typeof vi.fn>>;
  let scriptCreateOrReplace: ReturnType<typeof vi.fn>;
  let scriptValue: Array<{ path: string; priority: number; layout?: string }>;
  const enumEntity = { getNextEnumEntityId: vi.fn(() => 1) } as any;

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);
    store = {
      dispatch: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      replaceReducer: vi.fn(),
    } as any;

    scriptValue = [];
    scriptCreateOrReplace = vi.fn((_e: number, v: { value: typeof scriptValue }) => {
      scriptValue = v.value;
    });
    const scriptComp = {
      componentId: 9,
      componentName: 'asset-packs::Script',
      getOrNull: () => (scriptValue.length ? { value: scriptValue } : null),
      createOrReplace: scriptCreateOrReplace,
    };
    const engine = {
      RootEntity: 0,
      getEntityState: () => EntityState.UsedEntity,
      getComponent: (nameOrId: string | number) => {
        if (nameOrId === 'asset-packs::Script') return scriptComp;
        throw new Error('Component not found');
      },
      componentsIter: () => [scriptComp][Symbol.iterator](),
    } as any;
    ops = {
      addAsset: vi.fn(() => 600),
      dispatch: vi.fn().mockResolvedValue(undefined),
    };
    new SceneServer(iframe, store, undefined, undefined, ops as any, engine, enumEntity);
    host = new RPC('SceneRpcInbound', parent);
  });

  afterEach(() => vi.resetAllMocks());

  it('attach_script: appends a Script entry and dispatches', async () => {
    const result = await host.request('attach_script', {
      entity: 512,
      path: 'assets/Scripts/Door.tsx',
    });
    expect(scriptCreateOrReplace).toHaveBeenCalledWith(512, {
      value: [{ path: 'assets/Scripts/Door.tsx', priority: 0, layout: '{"params":{}}' }],
    });
    expect(ops.dispatch).toHaveBeenCalled();
    expect(result).toEqual({ entity: 512, path: 'assets/Scripts/Door.tsx' });
  });

  it('search_catalog: filters by query', async () => {
    vi.mocked(fetchLatestCatalog).mockResolvedValue([
      {
        id: 'p1',
        name: 'Pack',
        thumbnail: '',
        assets: [
          { id: 'door', name: 'Wooden Door', category: 'decorations', tags: ['interactive'] },
          { id: 'rock', name: 'Rock', category: 'nature', tags: [] },
        ],
      },
    ] as any);
    const res = (await host.request('search_catalog', { query: 'door' })) as {
      total: number;
      results: { id: string }[];
    };
    expect(res.total).toBe(1);
    expect(res.results[0].id).toBe('door');
  });

  it('place_smart_item: imports files and calls addAsset with the resolved base', async () => {
    vi.mocked(getAssetById).mockReturnValue({
      id: 'door',
      name: 'Wooden Door',
      category: 'decorations',
      tags: [],
      contents: { 'model.glb': 'hash1' },
      composite: { version: 1, components: [] },
    } as any);
    const importAsset = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDataLayerInterface).mockReturnValue({ importAsset } as any);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
    );

    const result = (await host.request('place_smart_item', {
      assetId: 'door',
      name: 'My Door',
      position: { x: 1, y: 0, z: 2 },
    })) as { entity: number; name: string };

    expect(importAsset).toHaveBeenCalled();
    expect(ops.addAsset).toHaveBeenCalledWith(
      0,
      'model.glb',
      'My Door',
      { x: 1, y: 0, z: 2 },
      expect.stringContaining('asset-packs/wooden_door'),
      enumEntity,
      { version: 1, components: [] },
      'door',
      false,
    );
    expect(result).toEqual({ entity: 600, name: 'My Door' });
    vi.unstubAllGlobals();
  });

  it('place_smart_item: rejects an unknown asset id', async () => {
    vi.mocked(getAssetById).mockReturnValue(null);
    vi.mocked(fetchLatestCatalog).mockResolvedValue([]);
    await expect(host.request('place_smart_item', { assetId: 'nope' })).rejects.toThrow(
      'No catalog asset',
    );
  });

  it('undo: calls the data-layer undo (used by "revert AI turn")', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDataLayerInterface).mockReturnValue({ undo } as any);
    const res = await host.request('undo', {});
    expect(undo).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });
});

// get_selection reads the editor's Selection ECS component off the live engine and resolves
// names via the Name component — the "[Editor context]" the composer chip + send context use.
describe('SceneServer RPC get_selection', () => {
  let parent: InMemoryTransport;
  let iframe: InMemoryTransport;
  let host: RPC<string, any, any>;

  beforeEach(() => {
    parent = new InMemoryTransport();
    iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);

    const store = { dispatch: vi.fn(), getState: vi.fn(), subscribe: vi.fn() } as any as Store;
    const selectionComp = { __selection: true };
    const nameComp = { getOrNull: (e: number) => (e === 512 ? { value: 'Front Door' } : null) };
    const engine = {
      RootEntity: 0,
      getComponent: (n: string) => {
        if (n === EditorComponentNames.Selection) return selectionComp;
        if (n === NameEngine.componentName) return nameComp;
        throw new Error(`unexpected getComponent(${n})`);
      },
      // Two entities selected: 512 (named) and 513 (unnamed → empty string).
      getEntitiesWith: (c: unknown) =>
        (c === selectionComp ? [[512], [513]] : [])[Symbol.iterator](),
    } as any;

    new SceneServer(iframe, store, undefined, undefined, { dispatch: vi.fn() } as any, engine);
    host = new RPC('SceneRpcInbound', parent);
  });

  afterEach(() => vi.resetAllMocks());

  it('returns the selected entities with their names (blank when unnamed)', async () => {
    const res = await host.request('get_selection', {});
    expect(res).toEqual({
      selected: [
        { id: 512, name: 'Front Door' },
        { id: 513, name: '' },
      ],
    });
  });

  // #1507 / #1511: the reserved entities (Scene root / Player / Camera) carry no Name, so the
  // chip used to show a bare "#id". Label them exactly as the entity tree does.
  it('labels the reserved Scene / Player / Camera entities like the tree', async () => {
    const p = new InMemoryTransport();
    const i = new InMemoryTransport();
    p.connect(i);
    i.connect(p);

    const store = { dispatch: vi.fn(), getState: vi.fn(), subscribe: vi.fn() } as any as Store;
    const selectionComp = { __selection: true };
    const nameComp = { getOrNull: () => null }; // none of the reserved entities are named
    const engine = {
      RootEntity: 0,
      PlayerEntity: 1,
      CameraEntity: 2,
      getComponent: (n: string) => {
        if (n === EditorComponentNames.Selection) return selectionComp;
        if (n === NameEngine.componentName) return nameComp;
        throw new Error(`unexpected getComponent(${n})`);
      },
      getEntitiesWith: (c: unknown) =>
        (c === selectionComp ? [[0], [1], [2]] : [])[Symbol.iterator](),
    } as any;

    new SceneServer(i, store, undefined, undefined, { dispatch: vi.fn() } as any, engine);
    const localHost = new RPC('SceneRpcInbound', p);

    const res = await localHost.request('get_selection', {});
    expect(res).toEqual({
      selected: [
        { id: 0, name: 'Scene' },
        { id: 1, name: 'Player' },
        { id: 2, name: 'Camera' },
      ],
    });
  });
});

// clear_selection drops the Selection component from every selected entity (the AI panel's
// "Clear" affordance) and ticks the engine without marking the scene dirty.
describe('SceneServer RPC clear_selection', () => {
  it('deselects every entity', async () => {
    const parent = new InMemoryTransport();
    const iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);

    const store = { dispatch: vi.fn(), getState: vi.fn(), subscribe: vi.fn() } as any as Store;
    const sel = new Set<number>([512, 513]);
    const selectionComp = { deleteFrom: vi.fn((e: number) => void sel.delete(e)) };
    const engine = {
      RootEntity: 0,
      getComponent: (n: string) => {
        if (n === EditorComponentNames.Selection) return selectionComp;
        throw new Error(`unexpected getComponent(${n})`);
      },
      getEntitiesWith: (c: unknown) =>
        (c === selectionComp ? [...sel].map(id => [id]) : [])[Symbol.iterator](),
    } as any;
    const operations = { dispatch: vi.fn(async () => undefined) } as any;

    new SceneServer(iframe, store, undefined, undefined, operations, engine);
    const host = new RPC('SceneRpcInbound', parent);

    const res = await host.request('clear_selection', {});
    expect(res).toEqual({ ok: true });
    expect(selectionComp.deleteFrom).toHaveBeenCalledWith(512);
    expect(selectionComp.deleteFrom).toHaveBeenCalledWith(513);
    expect(operations.dispatch).toHaveBeenCalledWith({ dirty: false });
  });
});

// get_scene_settings / set_scene_settings read and patch the versioned SceneMetadata
// component on the root, so the AI can change scene.json fields (#1527).
describe('SceneServer RPC scene settings', () => {
  it('reads the current settings and merges a patch into them', async () => {
    const parent = new InMemoryTransport();
    const iframe = new InMemoryTransport();
    parent.connect(iframe);
    iframe.connect(parent);

    const store = { dispatch: vi.fn(), getState: vi.fn(), subscribe: vi.fn() } as any as Store;
    let value: Record<string, unknown> = {
      name: 'Old name',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
    };
    // Stands in for the active SceneMetadata component: resolveActiveSceneComponent picks the
    // newest version whose `has(root)` is true — this mock answers for any version name.
    const sceneComp = {
      has: () => true,
      getOrNull: () => value,
      createOrReplace: (_e: number, v: Record<string, unknown>) => {
        value = v;
      },
    };
    const engine = {
      RootEntity: 0,
      getComponentOrNull: () => sceneComp,
      getComponent: () => sceneComp,
    } as any;
    const operations = {
      updateValue: (_c: unknown, _e: number, v: Record<string, unknown>) =>
        sceneComp.createOrReplace(0, v),
      dispatch: vi.fn(async () => undefined),
    } as any;

    new SceneServer(iframe, store, undefined, undefined, operations, engine);
    const host = new RPC('SceneRpcInbound', parent);

    const got = await host.request('get_scene_settings', {});
    expect(got.settings).toMatchObject({ name: 'Old name' });

    const set = await host.request('set_scene_settings', {
      name: 'New name',
      description: 'Hi',
    } as any);
    // Patched fields replace; untouched fields (layout) are preserved.
    expect(set.settings).toMatchObject({
      name: 'New name',
      description: 'Hi',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
    });
    expect(operations.dispatch).toHaveBeenCalled();
  });
});
