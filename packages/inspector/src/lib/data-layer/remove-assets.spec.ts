import { removeAssetFiles } from './remove-assets';

describe('removeAssetFiles', () => {
  const originalWarn = console.warn;
  beforeEach(() => {
    console.warn = () => {};
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  it('should remove everything in one batch when the host supports it', async () => {
    const removeAssets = vi.fn().mockResolvedValue({});
    const removeAsset = vi.fn().mockResolvedValue({});
    await removeAssetFiles({ removeAssets, removeAsset }, ['assets/a.glb', 'assets/b.glb']);
    expect(removeAssets).toHaveBeenCalledWith({ paths: ['assets/a.glb', 'assets/b.glb'] });
    expect(removeAsset).not.toHaveBeenCalled();
  });

  it('should fall back to removing the files one by one on an older host', async () => {
    const removeAssets = vi.fn().mockRejectedValue(new Error('Unknown method'));
    const removeAsset = vi.fn().mockResolvedValue({});
    await removeAssetFiles({ removeAssets, removeAsset }, ['assets/a.glb', 'assets/b.glb']);
    expect(removeAsset).toHaveBeenCalledTimes(2);
    expect(removeAsset).toHaveBeenNthCalledWith(1, { path: 'assets/a.glb' });
    expect(removeAsset).toHaveBeenNthCalledWith(2, { path: 'assets/b.glb' });
  });

  it('should do nothing for an empty list', async () => {
    const removeAssets = vi.fn();
    const removeAsset = vi.fn();
    await removeAssetFiles({ removeAssets, removeAsset }, []);
    expect(removeAssets).not.toHaveBeenCalled();
    expect(removeAsset).not.toHaveBeenCalled();
  });
});
