import { FreeCamera, NullEngine, Scene, Vector3, ScreenshotTools } from '@babylonjs/core';
import { InMemoryTransport } from '@dcl/mini-rpc';
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
      expect(spy).toHaveBeenCalledWith('open_directory', { path });
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
