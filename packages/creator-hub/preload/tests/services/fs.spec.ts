import type { Stats } from 'fs';
import fsPromises from 'fs/promises';
import nodePath from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shell } from 'electron';

import * as fs from '../../src/services/fs';

vi.mock('fs/promises');
vi.mock('path');
vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn(),
  },
}));

describe('fs service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolve', () => {
    const mockPaths = ['path1', 'path2', 'path3'];
    const mockResolvedPath = '/resolved/path1/path2/path3';

    beforeEach(() => {
      vi.mocked(nodePath.resolve).mockReturnValue(mockResolvedPath);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call nodePath.resolve with provided paths', async () => {
      await fs.resolve(...mockPaths);

      expect(nodePath.resolve).toHaveBeenCalledWith(...mockPaths);
    });

    it('should return the resolved path', async () => {
      const result = await fs.resolve(...mockPaths);

      expect(result).toBe(mockResolvedPath);
    });
  });

  describe('readFile', () => {
    const mockPath = '/path/to/file.txt';
    const mockContent = Buffer.from('file content');

    beforeEach(() => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        mockContent as Awaited<ReturnType<typeof fsPromises.readFile>>,
      );
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.readFile with the provided path', async () => {
      await fs.readFile(mockPath);

      expect(fsPromises.readFile).toHaveBeenCalledWith(mockPath);
    });

    it('should return the file content', async () => {
      const result = await fs.readFile(mockPath);

      expect(result).toEqual(mockContent);
    });
  });

  describe('writeFile', () => {
    const mockPath = '/path/to/file.txt';
    const mockContent = 'file content';
    const mockOptions = { encoding: 'utf-8' as const };

    beforeEach(() => {
      vi.mocked(nodePath.dirname).mockReturnValue('/path/to');
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create parent directory', async () => {
      await fs.writeFile(mockPath, mockContent);

      expect(nodePath.dirname).toHaveBeenCalledWith(mockPath);
      expect(fsPromises.mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
    });

    it('should write file with content', async () => {
      await fs.writeFile(mockPath, mockContent);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(mockPath, mockContent, undefined);
    });

    it('should write file with options', async () => {
      await fs.writeFile(mockPath, mockContent, mockOptions);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(mockPath, mockContent, mockOptions);
    });
  });

  describe('exists', () => {
    const mockPath = '/path/to/check';

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('when path exists', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.stat).mockResolvedValue({} as Stats);
      });

      it('should return true', async () => {
        const result = await fs.exists(mockPath);

        expect(result).toBe(true);
      });

      it('should call fs.stat with the path', async () => {
        await fs.exists(mockPath);

        expect(fsPromises.stat).toHaveBeenCalledWith(mockPath);
      });
    });

    describe('when path does not exist', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.stat).mockRejectedValue(new Error('ENOENT'));
      });

      it('should return false', async () => {
        const result = await fs.exists(mockPath);

        expect(result).toBe(false);
      });
    });
  });

  describe('rm', () => {
    const mockPath = '/path/to/remove';

    beforeEach(() => {
      vi.mocked(fsPromises.rm).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.rm with the path', async () => {
      await fs.rm(mockPath);

      expect(fsPromises.rm).toHaveBeenCalledWith(mockPath, undefined);
    });

    it('should call fs.rm with recursive option', async () => {
      await fs.rm(mockPath, { recursive: true });

      expect(fsPromises.rm).toHaveBeenCalledWith(mockPath, { recursive: true });
    });
  });

  describe('readdir', () => {
    const mockPath = '/path/to/directory';
    const mockFiles = ['file1.txt', 'file2.txt', 'folder1'];

    beforeEach(() => {
      vi.mocked(fsPromises.readdir).mockResolvedValue(mockFiles as any);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.readdir with the path', async () => {
      await fs.readdir(mockPath);

      expect(fsPromises.readdir).toHaveBeenCalledWith(mockPath);
    });

    it('should return the list of files', async () => {
      const result = await fs.readdir(mockPath);

      expect(result).toEqual(mockFiles);
    });
  });

  describe('isDirectory', () => {
    const mockPath = '/path/to/check';

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('when path is a directory', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.stat).mockResolvedValue({
          isDirectory: () => true,
        } as Stats);
      });

      it('should return true', async () => {
        const result = await fs.isDirectory(mockPath);

        expect(result).toBe(true);
      });
    });

    describe('when path is not a directory', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.stat).mockResolvedValue({
          isDirectory: () => false,
        } as Stats);
      });

      it('should return false', async () => {
        const result = await fs.isDirectory(mockPath);

        expect(result).toBe(false);
      });
    });

    describe('when stat fails', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.stat).mockRejectedValue(new Error('ENOENT'));
      });

      it('should return false', async () => {
        const result = await fs.isDirectory(mockPath);

        expect(result).toBe(false);
      });
    });
  });

  describe('isWritable', () => {
    const mockPath = '/path/to/check';

    beforeEach(() => {
      vi.mocked(nodePath.join).mockImplementation((...args) => args.join('/'));
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('when directory is writable', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
        vi.mocked(fsPromises.rm).mockResolvedValue(undefined);
      });

      it('should return true', async () => {
        const result = await fs.isWritable(mockPath);

        expect(result).toBe(true);
      });

      it('should create and remove test file', async () => {
        await fs.isWritable(mockPath);

        expect(fsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.Test-Write'),
          '',
        );
        expect(fsPromises.rm).toHaveBeenCalledWith(expect.stringContaining('.Test-Write'));
      });
    });

    describe('when directory is not writable', () => {
      beforeEach(() => {
        vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES'));
      });

      it('should return false', async () => {
        const result = await fs.isWritable(mockPath);

        expect(result).toBe(false);
      });
    });
  });

  describe('mkdir', () => {
    const mockPath = '/path/to/create';

    beforeEach(() => {
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.mkdir with the path', async () => {
      await fs.mkdir(mockPath);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(mockPath, undefined);
    });

    it('should call fs.mkdir with recursive option', async () => {
      await fs.mkdir(mockPath, { recursive: true });

      expect(fsPromises.mkdir).toHaveBeenCalledWith(mockPath, { recursive: true });
    });
  });

  describe('rmdir', () => {
    const mockPath = '/path/to/remove';

    beforeEach(() => {
      vi.mocked(fsPromises.rmdir).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.rmdir with the path', async () => {
      await fs.rmdir(mockPath);

      expect(fsPromises.rmdir).toHaveBeenCalledWith(mockPath);
    });
  });

  describe('stat', () => {
    const mockPath = '/path/to/file';
    const mockStats = {
      size: 1234,
      isDirectory: () => false,
      isFile: () => true,
    } as Stats;

    beforeEach(() => {
      vi.mocked(fsPromises.stat).mockResolvedValue(mockStats);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.stat with the path', async () => {
      await fs.stat(mockPath);

      expect(fsPromises.stat).toHaveBeenCalledWith(mockPath);
    });

    it('should return the stats', async () => {
      const result = await fs.stat(mockPath);

      expect(result).toEqual(mockStats);
    });
  });

  describe('cp', () => {
    const mockSrc = '/path/to/source';
    const mockDest = '/path/to/destination';

    beforeEach(() => {
      vi.mocked(fsPromises.cp).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call fs.cp with source and destination', async () => {
      await fs.cp(mockSrc, mockDest);

      expect(fsPromises.cp).toHaveBeenCalledWith(mockSrc, mockDest, undefined);
    });

    it('should call fs.cp with recursive option', async () => {
      await fs.cp(mockSrc, mockDest, { recursive: true });

      expect(fsPromises.cp).toHaveBeenCalledWith(mockSrc, mockDest, { recursive: true });
    });
  });

  describe('openPath', () => {
    const mockPath = '/path/to/open';

    beforeEach(() => {
      vi.mocked(shell.openPath).mockResolvedValue('');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call shell.openPath with the path', async () => {
      await fs.openPath(mockPath);

      expect(shell.openPath).toHaveBeenCalledWith(mockPath);
    });
  });
});
