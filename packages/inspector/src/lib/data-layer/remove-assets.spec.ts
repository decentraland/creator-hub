import {
  removeAssetFiles,
  removeEmptiedFolders,
  removeEmptyFolders,
  waitForLegacyUndoCommit,
} from './remove-assets';

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

describe('folder cleanup', () => {
  let folders: Set<string>;
  let files: Set<string>;
  let storage: Parameters<typeof removeEmptyFolders>[0];

  const childrenOf = (path: string) =>
    [...folders, ...files].filter(
      entry => entry.startsWith(path + '/') && !entry.slice(path.length + 1).includes('/'),
    );

  beforeEach(() => {
    folders = new Set(['assets', 'assets/props']);
    files = new Set();
    storage = {
      list: vi.fn(async (path: string) => {
        if (!folders.has(path)) throw new Error(`ENOENT: ${path}`);
        return childrenOf(path).map(entry => ({
          name: entry.slice(path.length + 1),
          isDirectory: folders.has(entry),
        }));
      }),
      rmdir: vi.fn(async (path: string) => {
        if (!folders.has(path)) throw new Error(`ENOENT: ${path}`);
        if (childrenOf(path).length) throw new Error(`ENOTEMPTY: ${path}`);
        folders.delete(path);
      }),
    };
  });

  describe('removeEmptyFolders', () => {
    describe('when the folder holds only empty folders', () => {
      beforeEach(() => {
        folders.add('assets/props/trees');
        folders.add('assets/props/trees/pine');
        folders.add('assets/props/rocks');
      });

      it('should remove the folder and every folder below it', async () => {
        await removeEmptyFolders(storage, ['assets/props']);
        expect([...folders]).toEqual(['assets']);
      });
    });

    describe('when a folder below it still holds a file', () => {
      beforeEach(() => {
        folders.add('assets/props/trees');
        folders.add('assets/props/rocks');
        files.add('assets/props/rocks/boulder.glb');
      });

      it('should remove only the folders left empty', async () => {
        await removeEmptyFolders(storage, ['assets/props']);
        expect([...folders]).toEqual(['assets', 'assets/props', 'assets/props/rocks']);
      });
    });

    describe('when the folder is no longer on disk', () => {
      beforeEach(() => {
        folders.delete('assets/props');
      });

      it('should resolve without removing anything', async () => {
        await expect(removeEmptyFolders(storage, ['assets/props'])).resolves.toBeUndefined();
      });
    });
  });

  describe('removeEmptiedFolders', () => {
    beforeEach(() => {
      folders.add('assets/props/rocks');
      folders.add('assets/props/rocks/small');
    });

    describe('when the removed files leave their folders empty', () => {
      it('should remove every emptied folder up to, but not including, the assets folder', async () => {
        await removeEmptiedFolders(storage, ['assets/props/rocks/small/pebble.glb']);
        expect([...folders]).toEqual(['assets']);
      });
    });

    describe('when a folder on the way up still holds a file', () => {
      beforeEach(() => {
        files.add('assets/props/tree.glb');
      });

      it('should stop at that folder', async () => {
        await removeEmptiedFolders(storage, ['assets/props/rocks/small/pebble.glb']);
        expect([...folders]).toEqual(['assets', 'assets/props']);
      });
    });

    describe('when the removed file sits directly in the assets folder', () => {
      beforeEach(() => {
        files.clear();
        folders = new Set(['assets']);
      });

      it('should leave the assets folder', async () => {
        await removeEmptiedFolders(storage, ['assets/logo.png']);
        expect([...folders]).toEqual(['assets']);
      });
    });
  });
});
