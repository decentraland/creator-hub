import { PartialRemovalError, removeAssetFiles, removeAssetFilesSettled } from './remove-assets';

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
    const removed = await removeAssetFiles({ removeAssets, removeAsset }, [
      'assets/a.glb',
      'assets/b.glb',
    ]);
    expect(removed).toEqual(['assets/a.glb', 'assets/b.glb']);
    expect(removeAssets).toHaveBeenCalledWith({ paths: ['assets/a.glb', 'assets/b.glb'] });
    expect(removeAsset).not.toHaveBeenCalled();
  });

  it('should fall back to removing the files one by one on an older host', async () => {
    const removeAssets = vi.fn().mockRejectedValue(new Error('Unknown method'));
    const removeAsset = vi.fn().mockResolvedValue({});
    const removed = await removeAssetFiles({ removeAssets, removeAsset }, [
      'assets/a.glb',
      'assets/b.glb',
    ]);
    expect(removed).toEqual(['assets/a.glb', 'assets/b.glb']);
    expect(removeAsset).toHaveBeenCalledTimes(2);
    expect(removeAsset).toHaveBeenNthCalledWith(1, { path: 'assets/a.glb' });
    expect(removeAsset).toHaveBeenNthCalledWith(2, { path: 'assets/b.glb' });
  });

  it('should report the files removed before a one-by-one removal failed', async () => {
    const removeAssets = vi.fn().mockRejectedValue(new Error('Unknown method'));
    const removeAsset = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('EBUSY'));
    const removal = removeAssetFiles({ removeAssets, removeAsset }, [
      'assets/a.glb',
      'assets/b.glb',
      'assets/c.glb',
    ]);
    await expect(removal).rejects.toBeInstanceOf(PartialRemovalError);
    await expect(removal).rejects.toMatchObject({ removed: ['assets/a.glb'] });
    expect(removeAsset).toHaveBeenCalledTimes(2);
  });

  it('should do nothing for an empty list', async () => {
    const removeAssets = vi.fn();
    const removeAsset = vi.fn();
    expect(await removeAssetFiles({ removeAssets, removeAsset }, [])).toEqual([]);
    expect(removeAssets).not.toHaveBeenCalled();
    expect(removeAsset).not.toHaveBeenCalled();
  });

  describe('removeAssetFilesSettled', () => {
    it('should report what was removed instead of throwing on a partial failure', async () => {
      const removeAssets = vi.fn().mockRejectedValue(new Error('Unknown method'));
      const removeAsset = vi
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('EBUSY'));
      const result = await removeAssetFilesSettled({ removeAssets, removeAsset }, [
        'assets/a.glb',
        'assets/b.glb',
      ]);
      expect(result.removed).toEqual(['assets/a.glb']);
      expect(result.error).toBeInstanceOf(PartialRemovalError);
    });

    it('should report every path when the removal succeeds', async () => {
      const result = await removeAssetFilesSettled(
        { removeAssets: vi.fn(), removeAsset: vi.fn() },
        ['assets/a.glb'],
      );
      expect(result).toEqual({ removed: ['assets/a.glb'] });
    });
  });
});
