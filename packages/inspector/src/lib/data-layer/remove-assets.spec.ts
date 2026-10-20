import { removeAssetFiles, waitForLegacyUndoCommit } from './remove-assets';

const MISSING_METHOD = new Error('Method RemoveAssets not implemented in server port');

describe('removeAssetFiles', () => {
  const originalWarn = console.warn;
  beforeEach(() => {
    console.warn = () => {};
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  describe('when the host supports batch removal', () => {
    it('should remove everything in one batch', async () => {
      const removeAssets = vi
        .fn()
        .mockResolvedValue({ success: ['assets/a.glb', 'assets/b.glb'], failed: [] });
      const removeAsset = vi.fn();
      const result = await removeAssetFiles({ removeAssets, removeAsset }, [
        'assets/a.glb',
        'assets/b.glb',
      ]);
      expect(result).toEqual({ removed: ['assets/a.glb', 'assets/b.glb'], batched: true });
      expect(removeAssets).toHaveBeenCalledWith({ paths: ['assets/a.glb', 'assets/b.glb'] });
      expect(removeAsset).not.toHaveBeenCalled();
    });

    it('should report the files it removed when it could not remove them all', async () => {
      const removeAssets = vi
        .fn()
        .mockResolvedValue({ success: ['assets/a.glb'], failed: ['assets/b.glb'] });
      const result = await removeAssetFiles({ removeAssets, removeAsset: vi.fn() }, [
        'assets/a.glb',
        'assets/b.glb',
      ]);
      expect(result.removed).toEqual(['assets/a.glb']);
      expect(result.batched).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should not fall back to one-by-one removal when the batch itself failed', async () => {
      const failure = new Error('RemoteError: disk full');
      const removeAsset = vi.fn();
      const result = await removeAssetFiles(
        { removeAssets: vi.fn().mockRejectedValue(failure), removeAsset },
        ['assets/a.glb'],
      );
      expect(result).toEqual({ removed: [], batched: true, error: failure });
      expect(removeAsset).not.toHaveBeenCalled();
    });
  });

  describe('when the host predates batch removal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should leave each removal its own undo window, the first included', async () => {
      const removeAsset = vi.fn().mockResolvedValue({});
      const removal = removeAssetFiles(
        { removeAssets: vi.fn().mockRejectedValue(MISSING_METHOD), removeAsset },
        ['assets/a.glb', 'assets/b.glb'],
      );
      await vi.advanceTimersByTimeAsync(149);
      expect(removeAsset).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(removeAsset).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(149);
      expect(removeAsset).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(removeAsset).toHaveBeenCalledTimes(2);
      await removal;
    });

    it('should remove the files one by one', async () => {
      const removeAsset = vi.fn().mockResolvedValue({});
      const removal = removeAssetFiles(
        { removeAssets: vi.fn().mockRejectedValue(MISSING_METHOD), removeAsset },
        ['assets/a.glb', 'assets/b.glb'],
      );
      await vi.runAllTimersAsync();
      const result = await removal;
      expect(result).toEqual({ removed: ['assets/a.glb', 'assets/b.glb'], batched: false });
      expect(removeAsset).toHaveBeenNthCalledWith(1, { path: 'assets/a.glb' });
      expect(removeAsset).toHaveBeenNthCalledWith(2, { path: 'assets/b.glb' });
    });

    it('should report the files removed before one failed', async () => {
      const failure = new Error('EBUSY');
      const removeAsset = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
      const removal = removeAssetFiles(
        { removeAssets: vi.fn().mockRejectedValue(MISSING_METHOD), removeAsset },
        ['assets/a.glb', 'assets/b.glb', 'assets/c.glb'],
      );
      await vi.runAllTimersAsync();
      const result = await removal;
      expect(result).toEqual({ removed: ['assets/a.glb'], batched: false, error: failure });
      expect(removeAsset).toHaveBeenCalledTimes(2);
    });
  });

  it('should do nothing for an empty list', async () => {
    const removeAssets = vi.fn();
    const removeAsset = vi.fn();
    expect(await removeAssetFiles({ removeAssets, removeAsset }, [])).toEqual({
      removed: [],
      batched: true,
    });
    expect(removeAssets).not.toHaveBeenCalled();
    expect(removeAsset).not.toHaveBeenCalled();
  });

  describe('waitForLegacyUndoCommit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const settled = vi.fn();
    const track = (promise: Promise<void>) => promise.then(settled);

    beforeEach(() => settled.mockClear());

    it('should wait past the undo window on a host without batch removal', async () => {
      const removeAssets = vi.fn().mockRejectedValue(MISSING_METHOD);
      void track(waitForLegacyUndoCommit({ removeAssets, removeAsset: vi.fn() }));
      await vi.advanceTimersByTimeAsync(149);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalled();
    });

    it('should not wait on a host with batch removal, and probe it only once', async () => {
      const removeAssets = vi.fn().mockResolvedValue({ success: [], failed: [] });
      const dataLayer = { removeAssets, removeAsset: vi.fn() };
      await waitForLegacyUndoCommit(dataLayer);
      await waitForLegacyUndoCommit(dataLayer);
      expect(removeAssets).toHaveBeenCalledTimes(1);
      expect(removeAssets).toHaveBeenCalledWith({ paths: [] });
    });
  });
});
