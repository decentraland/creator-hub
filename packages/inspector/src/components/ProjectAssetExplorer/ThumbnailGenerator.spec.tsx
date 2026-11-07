import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThumbnailGenerator } from './ThumbnailGenerator';

const mocks = vi.hoisted(() => ({
  engine: vi.fn(),
  loadModelContainer: vi.fn(),
  isEmoteContainer: vi.fn(),
  getAssetData: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: class {
    constructor(...args: unknown[]) {
      mocks.engine(...args);
    }
    dispose() {}
  },
}));
vi.mock('@babylonjs/loaders/glTF', () => ({}));
vi.mock('../AssetPreview/emote', () => ({ isEmoteContainer: mocks.isEmoteContainer }));
vi.mock('../AssetBrowserPreview/gltfResolver', () => ({
  loadModelContainer: mocks.loadModelContainer,
  createLocalResolver: (path: string) => `resolver for ${path}`,
}));
vi.mock('../AssetBrowserPreview/modelScene', () => ({
  createPreviewScene: () => ({
    scene: { whenReadyAsync: () => Promise.resolve(), render: vi.fn(), dispose: vi.fn() },
    camera: {},
  }),
  frameCamera: vi.fn(),
  isColliderMesh: (mesh: { name: string }) => mesh.name.includes('collider'),
}));
vi.mock('../../redux/data-layer', () => ({
  getDataLayerInterface: () => ({ getAssetData: mocks.getAssetData }),
  saveThumbnail: (payload: unknown) => ({ type: 'saveThumbnail', payload }),
}));
vi.mock('../../redux/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function fakeContainer(overrides: Record<string, unknown> = {}) {
  return {
    meshes: [{ name: 'body', isVisible: true, getTotalVertices: () => 12 }],
    animationGroups: [],
    transformNodes: [],
    addAllToScene: vi.fn(),
    removeAllFromScene: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  };
}

describe('ThumbnailGenerator', () => {
  let onProcessed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(PNG);
    mocks.engine.mockReset();
    mocks.loadModelContainer.mockReset();
    mocks.isEmoteContainer.mockReset().mockReturnValue(false);
    mocks.getAssetData.mockReset().mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
    mocks.dispatch.mockReset();
    onProcessed = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderQueue = (queue: string[]) =>
    render(
      <ThumbnailGenerator
        queue={queue}
        onProcessed={onProcessed}
      />,
    );

  describe('when a queued model loads', () => {
    beforeEach(() => {
      mocks.loadModelContainer.mockResolvedValue(fakeContainer());
    });

    it('should read it through the data layer and resolve its textures from its own folder', async () => {
      renderQueue(['Models/tree.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalled());
      expect(mocks.getAssetData).toHaveBeenCalledWith({ path: 'assets/Models/tree.glb' });
      expect(mocks.loadModelContainer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Uint8Array),
        'glb',
        'resolver for Models/tree.glb',
      );
    });

    it('should save the rendered thumbnail and report success', async () => {
      renderQueue(['Models/tree.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/tree.glb', true));
      expect(mocks.dispatch).toHaveBeenCalledWith({
        type: 'saveThumbnail',
        payload: { path: 'Models/tree.glb', content: expect.any(Uint8Array) },
      });
    });

    it('should release the model once it has been drawn', async () => {
      const container = fakeContainer();
      mocks.loadModelContainer.mockResolvedValue(container);
      renderQueue(['Models/tree.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalled());
      expect(container.removeAllFromScene).toHaveBeenCalled();
      expect(container.dispose).toHaveBeenCalled();
    });
  });

  describe('when a queued model cannot be loaded', () => {
    beforeEach(() => {
      mocks.loadModelContainer.mockRejectedValue(new Error('/images/0/uri: ../x.png is invalid'));
    });

    it('should report it as processed without a thumbnail', async () => {
      renderQueue(['Models/broken.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/broken.glb', false));
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('when a queued model is an avatar animation', () => {
    beforeEach(() => {
      mocks.isEmoteContainer.mockReturnValue(true);
      mocks.loadModelContainer.mockResolvedValue(fakeContainer());
    });

    it('should report it as processed without a thumbnail', async () => {
      renderQueue(['Models/dance.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/dance.glb', false));
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when a queued model has only collider geometry', () => {
    beforeEach(() => {
      mocks.loadModelContainer.mockResolvedValue(
        fakeContainer({
          meshes: [{ name: 'box_collider', isVisible: true, getTotalVertices: () => 8 }],
        }),
      );
    });

    it('should report it as processed without a thumbnail', async () => {
      renderQueue(['Models/invisible.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/invisible.glb', false));
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when the queue moves on before a model has finished loading', () => {
    it('should finish that load before starting the next one', async () => {
      let finishFirst: (container: unknown) => void = () => {};
      mocks.loadModelContainer
        .mockImplementationOnce(() => new Promise(resolve => (finishFirst = resolve)))
        .mockResolvedValue(fakeContainer());
      const { rerender } = renderQueue(['Models/first.glb', 'Models/second.glb']);
      await waitFor(() => expect(mocks.loadModelContainer).toHaveBeenCalledTimes(1));

      rerender(
        <ThumbnailGenerator
          queue={['Models/second.glb']}
          onProcessed={onProcessed}
        />,
      );
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mocks.loadModelContainer).toHaveBeenCalledTimes(1);

      finishFirst(fakeContainer());
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/second.glb', true));
      expect(onProcessed).not.toHaveBeenCalledWith('Models/first.glb', expect.anything());
    });
  });

  describe('when the browser refuses a WebGL context', () => {
    beforeEach(() => {
      mocks.engine.mockImplementation(() => {
        throw new Error('WebGL not supported');
      });
    });

    it('should report every queued model as processed without loading any of them', async () => {
      const { rerender } = renderQueue(['Models/a.glb', 'Models/b.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/a.glb', false));
      rerender(
        <ThumbnailGenerator
          queue={['Models/b.glb']}
          onProcessed={onProcessed}
        />,
      );
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/b.glb', false));
      expect(mocks.getAssetData).not.toHaveBeenCalled();
      expect(mocks.loadModelContainer).not.toHaveBeenCalled();
    });

    it('should log the problem once rather than once per model', async () => {
      const { rerender } = renderQueue(['Models/a.glb', 'Models/b.glb']);
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/a.glb', false));
      rerender(
        <ThumbnailGenerator
          queue={['Models/b.glb']}
          onProcessed={onProcessed}
        />,
      );
      await waitFor(() => expect(onProcessed).toHaveBeenCalledWith('Models/b.glb', false));
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
