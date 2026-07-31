import { FreeCamera, NullEngine, Scene, Vector3, ScreenshotTools } from '@babylonjs/core';
import { InMemoryTransport, RPC } from '@dcl/mini-rpc';
import type { Store } from '../../../redux/store';
import { SceneClient } from './client';
import { SceneServer } from './server';

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
});
