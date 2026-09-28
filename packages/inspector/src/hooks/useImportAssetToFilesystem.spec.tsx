import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { Asset } from '../lib/logic/catalog';
import { useImportAssetToFilesystem } from './useImportAssetToFilesystem';

const mocks = vi.hoisted(() => ({
  importAsset: vi.fn(),
  dispatch: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../redux/data-layer', () => ({
  getDataLayerInterface: () => ({ importAsset: mocks.importAsset }),
  getAssetCatalog: () => ({ type: 'getAssetCatalog' }),
  saveThumbnail: (payload: unknown) => ({ type: 'saveThumbnail', payload }),
}));
vi.mock('../redux/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../lib/logic/config', () => ({
  getConfig: () => ({ contentUrl: 'https://content.example' }),
}));
vi.mock('../lib/logic/analytics', () => ({
  analytics: { track: vi.fn() },
  Event: { ADD_ITEM: 'Add Item' },
}));

const asset = {
  id: 'ambient-birds',
  name: 'Ambient Sound - Forest Birds',
  category: 'sounds',
  tags: [],
  contents: {
    'ambient_sound.glb': 'hash-glb',
    'birds_(1).mp3': 'hash-mp3',
    'composite.json': 'hash-composite',
    'thumbnail.png': 'hash-thumbnail',
  },
} as unknown as Asset;

const fetchedHashes = () =>
  mocks.fetch.mock.calls.map(([url]: [string]) => url.split('/contents/')[1].split('?')[0]);

describe('useImportAssetToFilesystem', () => {
  beforeEach(() => {
    mocks.fetch.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1]).buffer });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.fetch.mockReset();
    mocks.importAsset.mockReset();
    mocks.dispatch.mockReset();
  });

  describe('when importing a catalog asset with no options', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useImportAssetToFilesystem());
      await result.current.importCatalogAssetToFilesystem(asset);
    });

    it('should download every content file', () => {
      expect(fetchedHashes().sort()).toEqual(
        ['hash-composite', 'hash-glb', 'hash-mp3', 'hash-thumbnail'].sort(),
      );
    });
  });

  describe('when skipping the template media', () => {
    let returned: { basePath: string; assetPath?: string };

    beforeEach(async () => {
      const { result } = renderHook(() => useImportAssetToFilesystem());
      returned = await result.current.importCatalogAssetToFilesystem(asset, {
        skipContent: path => path.endsWith('.mp3'),
      });
    });

    it('should not download the skipped file', () => {
      expect(fetchedHashes()).not.toContain('hash-mp3');
    });

    it('should import the remaining files', () => {
      const { content } = mocks.importAsset.mock.calls[0][0];
      expect([...content.keys()].sort()).toEqual(['ambient_sound.glb', 'composite.json']);
    });

    it('should still keep the thumbnail', () => {
      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'saveThumbnail' }),
      );
    });

    it('should report where the item landed', () => {
      expect(returned).toEqual({
        basePath: 'assets/asset-packs/ambient_sound_-_forest_birds',
        assetPath: 'ambient_sound.glb',
      });
    });
  });
});
