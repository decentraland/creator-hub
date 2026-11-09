import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelViewer } from './ModelViewer';

const mocks = vi.hoisted(() => ({
  engine: vi.fn(),
  loadModelContainer: vi.fn(),
}));

vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: class {
    constructor(...args: unknown[]) {
      mocks.engine(...args);
    }
  },
}));
vi.mock('@babylonjs/loaders/glTF', () => ({}));
vi.mock('./gltfResolver', () => ({ loadModelContainer: mocks.loadModelContainer }));
vi.mock('./modelScene', () => ({
  createPreviewScene: () => ({ scene: {}, camera: {} }),
  frameCamera: vi.fn(),
  isColliderMesh: () => false,
}));
vi.mock('./EmoteViewer', () => ({ EmoteViewer: () => null }));

describe('ModelViewer', () => {
  let onFailed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.engine.mockReset();
    mocks.loadModelContainer.mockReset();
    onFailed = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderViewer = () =>
    render(
      <ModelViewer
        source={{ kind: 'model', name: 'tree.glb', extension: 'glb', url: 'blob:tree' }}
        onStats={vi.fn()}
        onEmote={vi.fn()}
        onFailed={onFailed}
      />,
    );

  describe('when the browser refuses a WebGL context', () => {
    beforeEach(() => {
      mocks.engine.mockImplementation(() => {
        throw new Error('WebGL not supported');
      });
    });

    it('should report the failure instead of throwing out of the render', async () => {
      expect(() => renderViewer()).not.toThrow();
      await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
      expect(console.error).toHaveBeenCalledWith(
        'Could not start the model preview:',
        expect.any(Error),
      );
    });

    it('should not try to load the model', async () => {
      renderViewer();
      await waitFor(() => expect(onFailed).toHaveBeenCalled());
      expect(mocks.loadModelContainer).not.toHaveBeenCalled();
    });
  });
});
