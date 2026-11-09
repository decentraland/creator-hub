import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalResolver } from './gltfResolver';

const mocks = vi.hoisted(() => ({ getAssetData: vi.fn() }));

vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({ SceneLoader: {} }));
vi.mock('@babylonjs/loaders/glTF/2.0', () => ({ registerGLTFExtension: vi.fn() }));
vi.mock('@babylonjs/loaders/glTF', () => ({}));
vi.mock('../../lib/logic/catalog', () => ({ getContentsUrl: (hash: string) => hash }));
vi.mock('../../redux/data-layer', () => ({
  getDataLayerInterface: () => ({ getAssetData: mocks.getAssetData }),
}));

describe('createLocalResolver', () => {
  beforeEach(() => {
    mocks.getAssetData.mockReset().mockResolvedValue({ data: new Uint8Array([1]) });
  });

  describe('when a URI points to a sibling or a shared folder inside assets', () => {
    it('should read it relative to the model folder', async () => {
      const resolve = createLocalResolver('Models/Pack/tree.glb');
      await resolve('../../Images/Pack/bark.png');
      expect(mocks.getAssetData).toHaveBeenCalledWith({ path: 'assets/Images/Pack/bark.png' });
    });

    it('should accept backslash separators that stay inside assets', async () => {
      const resolve = createLocalResolver('Models/Pack/tree.glb');
      await resolve('..\\bark.png');
      expect(mocks.getAssetData).toHaveBeenCalledWith({ path: 'assets/Models/bark.png' });
    });
  });

  describe('when a URI climbs out of the assets folder', () => {
    it.each([
      ['with slashes', '../../../.env'],
      ['with backslashes', '..\\..\\..\\.env'],
      ['with encoded backslashes', '..%5C..%5C..%5C.env'],
      ['with mixed separators', '..\\../..%5C.env'],
    ])('should refuse it %s without reading anything', async (_label, uri) => {
      const resolve = createLocalResolver('Models/tree.glb');
      await expect(resolve(uri)).rejects.toThrow('outside the assets folder');
      expect(mocks.getAssetData).not.toHaveBeenCalled();
    });
  });

  describe('when a URI carries a drive or scheme', () => {
    it('should refuse it without reading anything', async () => {
      const resolve = createLocalResolver('tree.glb');
      await expect(resolve('C:\\secrets.txt')).rejects.toThrow('outside the assets folder');
      expect(mocks.getAssetData).not.toHaveBeenCalled();
    });
  });
});
