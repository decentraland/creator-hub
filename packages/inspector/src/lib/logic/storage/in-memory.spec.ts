import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from './in-memory';

describe('createInMemoryStorage', () => {
  describe('initialization', () => {
    it('should create empty storage when no initialFs is provided', async () => {
      const storage = createInMemoryStorage();
      expect(await storage.exists('any-file.txt')).toBe(false);
      expect(await storage.list('')).toEqual([]);
    });

    it('should initialize storage with provided files', async () => {
      const initialFs = {
        'file1.txt': Buffer.from('content1'),
        'file2.txt': Buffer.from('content2'),
        'dir/file3.txt': Buffer.from('content3'),
      };
      const storage = createInMemoryStorage(initialFs);

      expect(await storage.exists('file1.txt')).toBe(true);
      expect(await storage.exists('file2.txt')).toBe(true);
      expect(await storage.exists('dir/file3.txt')).toBe(true);
      expect(await storage.readFile('file1.txt')).toEqual(Buffer.from('content1'));
      expect(await storage.readFile('file2.txt')).toEqual(Buffer.from('content2'));
      expect(await storage.readFile('dir/file3.txt')).toEqual(Buffer.from('content3'));
    });
  });

  describe('writeFile', () => {
    it('should write a new file', async () => {
      const storage = createInMemoryStorage();
      const content = Buffer.from('test content');
      await storage.writeFile('test.txt', content);

      expect(await storage.exists('test.txt')).toBe(true);
      expect(await storage.readFile('test.txt')).toEqual(content);
    });

    it('should overwrite an existing file', async () => {
      const storage = createInMemoryStorage({
        'test.txt': Buffer.from('old content'),
      });

      const newContent = Buffer.from('new content');
      await storage.writeFile('test.txt', newContent);

      expect(await storage.readFile('test.txt')).toEqual(newContent);
    });

    it('should write files in nested directories', async () => {
      const storage = createInMemoryStorage();
      const content = Buffer.from('nested content');
      await storage.writeFile('dir/subdir/file.txt', content);

      expect(await storage.exists('dir/subdir/file.txt')).toBe(true);
      expect(await storage.readFile('dir/subdir/file.txt')).toEqual(content);
    });

    it('should write empty buffer', async () => {
      const storage = createInMemoryStorage();
      const emptyContent = Buffer.from('');
      await storage.writeFile('empty.txt', emptyContent);

      expect(await storage.exists('empty.txt')).toBe(true);
      expect(await storage.readFile('empty.txt')).toEqual(emptyContent);
      expect(await storage.readFile('empty.txt')).toHaveLength(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('content'),
      });

      expect(await storage.exists('file.txt')).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const storage = createInMemoryStorage();

      expect(await storage.exists('non-existent.txt')).toBe(false);
    });

    it('should return false for files in non-existing directories', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('content'),
      });

      expect(await storage.exists('dir/non-existent.txt')).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read existing file content', async () => {
      const content = Buffer.from('file content');
      const storage = createInMemoryStorage({
        'file.txt': content,
      });

      expect(await storage.readFile('file.txt')).toEqual(content);
    });

    it('should throw error when reading non-existing file', async () => {
      const storage = createInMemoryStorage();

      await expect(storage.readFile('non-existent.txt')).rejects.toThrow(
        "File non-existent.txt doesn't exists",
      );
    });

    it('should read files with binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const storage = createInMemoryStorage({
        'binary.bin': binaryContent,
      });

      expect(await storage.readFile('binary.bin')).toEqual(binaryContent);
    });
  });

  describe('delete', () => {
    it('should delete an existing file', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('content'),
      });

      await storage.delete('file.txt');
      expect(await storage.exists('file.txt')).toBe(false);
    });

    it('should not throw when deleting non-existing file', async () => {
      const storage = createInMemoryStorage();

      await expect(storage.delete('non-existent.txt')).resolves.not.toThrow();
      expect(await storage.exists('non-existent.txt')).toBe(false);
    });

    it('should delete files in nested directories', async () => {
      const storage = createInMemoryStorage({
        'dir/subdir/file.txt': Buffer.from('content'),
      });

      await storage.delete('dir/subdir/file.txt');
      expect(await storage.exists('dir/subdir/file.txt')).toBe(false);
    });

    it('should only delete the specified file, not others', async () => {
      const storage = createInMemoryStorage({
        'file1.txt': Buffer.from('content1'),
        'file2.txt': Buffer.from('content2'),
      });

      await storage.delete('file1.txt');
      expect(await storage.exists('file1.txt')).toBe(false);
      expect(await storage.exists('file2.txt')).toBe(true);
    });
  });

  describe('rmdir', () => {
    it('should remove directory and all files within it', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
        'dir/subdir/file3.txt': Buffer.from('content3'),
        'directory/file4.txt': Buffer.from('content4'),
        'other/file.txt': Buffer.from('other content'),
      });

      await storage.rmdir('dir');
      expect(await storage.exists('dir/file1.txt')).toBe(false);
      expect(await storage.exists('dir/file2.txt')).toBe(false);
      expect(await storage.exists('dir/subdir/file3.txt')).toBe(false);
      expect(await storage.exists('other/file.txt')).toBe(true);
      expect(await storage.exists('directory/file4.txt')).toBe(true);
    });

    it('should handle directory path with trailing slash', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
      });

      await storage.rmdir('dir/');
      expect(await storage.exists('dir/file1.txt')).toBe(false);
      expect(await storage.exists('dir/file2.txt')).toBe(false);
    });

    it('should handle directory path without trailing slash', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
      });

      await storage.rmdir('dir');
      expect(await storage.exists('dir/file1.txt')).toBe(false);
      expect(await storage.exists('dir/file2.txt')).toBe(false);
    });

    it('should remove directory that matches exact path', async () => {
      const storage = createInMemoryStorage({
        dir: Buffer.from('content'),
        'dir/file.txt': Buffer.from('file content'),
      });

      await storage.rmdir('dir');
      expect(await storage.exists('dir')).toBe(false);
      expect(await storage.exists('dir/file.txt')).toBe(false);
    });

    it('should not affect files outside the directory', async () => {
      const storage = createInMemoryStorage({
        'dir1/file1.txt': Buffer.from('content1'),
        'dir2/file2.txt': Buffer.from('content2'),
        'root.txt': Buffer.from('root content'),
      });

      await storage.rmdir('dir1');
      expect(await storage.exists('dir1/file1.txt')).toBe(false);
      expect(await storage.exists('dir2/file2.txt')).toBe(true);
      expect(await storage.exists('root.txt')).toBe(true);
    });

    it('should not throw when removing non-existing directory', async () => {
      const storage = createInMemoryStorage();

      await expect(storage.rmdir('non-existent-dir')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array for empty storage', async () => {
      const storage = createInMemoryStorage();
      expect(await storage.list('')).toEqual([]);
    });

    it('should list files in root directory', async () => {
      const storage = createInMemoryStorage({
        'file1.txt': Buffer.from('content1'),
        'file2.txt': Buffer.from('content2'),
      });

      const files = await storage.list('');
      expect(files).toHaveLength(2);
      expect(files).toContainEqual({ name: 'file1.txt', isDirectory: false });
      expect(files).toContainEqual({ name: 'file2.txt', isDirectory: false });
    });

    it('should list directories in root', async () => {
      const storage = createInMemoryStorage({
        'dir/file.txt': Buffer.from('content'),
        'other/file.txt': Buffer.from('content'),
      });

      const files = await storage.list('');
      expect(files).toHaveLength(2);
      expect(files).toContainEqual({ name: 'dir', isDirectory: true });
      expect(files).toContainEqual({ name: 'other', isDirectory: true });
    });

    it('should list files and directories together', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('content'),
        'dir/subfile.txt': Buffer.from('content'),
      });

      const files = await storage.list('');
      expect(files).toHaveLength(2);
      expect(files).toContainEqual({ name: 'file.txt', isDirectory: false });
      expect(files).toContainEqual({ name: 'dir', isDirectory: true });
    });

    it('should list files in a specific directory', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
        'dir/subdir/file3.txt': Buffer.from('content3'),
        'other/file.txt': Buffer.from('content'),
      });

      const files = await storage.list('dir/');
      expect(files).toHaveLength(3);
      expect(files).toContainEqual({ name: 'file1.txt', isDirectory: false });
      expect(files).toContainEqual({ name: 'file2.txt', isDirectory: false });
      expect(files).toContainEqual({ name: 'subdir', isDirectory: true });
    });

    it('should not list files from parent directories', async () => {
      const storage = createInMemoryStorage({
        'root.txt': Buffer.from('content'),
        'dir/file.txt': Buffer.from('content'),
      });

      const files = await storage.list('dir/');
      expect(files).toHaveLength(1);
      expect(files).toContainEqual({ name: 'file.txt', isDirectory: false });
      expect(files).not.toContainEqual({ name: 'root.txt', isDirectory: false });
    });

    it('should not duplicate directory entries', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
        'dir/subdir/file3.txt': Buffer.from('content3'),
      });

      const files = await storage.list('dir/');
      const subdirEntries = files.filter(f => f.name === 'subdir');
      expect(subdirEntries).toHaveLength(1);
    });

    it('should handle nested directory listing', async () => {
      const storage = createInMemoryStorage({
        'dir/subdir/file.txt': Buffer.from('content'),
        'dir/subdir/another.txt': Buffer.from('content'),
      });

      const files = await storage.list('dir/subdir/');
      expect(files).toHaveLength(2);
      expect(files).toContainEqual({ name: 'file.txt', isDirectory: false });
      expect(files).toContainEqual({ name: 'another.txt', isDirectory: false });
    });

    it('should return empty array for non-existing directory', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('content'),
      });

      const files = await storage.list('non-existent-dir');
      expect(files).toEqual([]);
    });

    it('should handle paths without trailing slash (treats leading slash as empty directory)', async () => {
      const storage = createInMemoryStorage({
        'dir/file1.txt': Buffer.from('content1'),
        'dir/file2.txt': Buffer.from('content2'),
      });

      // When path doesn't end with '/', the leading '/' in the fileName
      // is treated as an empty directory name, and files are not directly listed
      const files = await storage.list('dir');
      // The empty string directory is created from the leading '/'
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({ name: '', isDirectory: true });
    });
  });

  describe('stat', () => {
    it('should return file size for existing file', async () => {
      const content = Buffer.from('test content');
      const storage = createInMemoryStorage({
        'file.txt': content,
      });

      const stats = await storage.stat('file.txt');
      expect(stats).toEqual({ size: content.length });
    });

    it('should return size 0 for empty file', async () => {
      const storage = createInMemoryStorage({
        'empty.txt': Buffer.from(''),
      });

      const stats = await storage.stat('empty.txt');
      expect(stats).toEqual({ size: 0 });
    });

    it('should return correct size for large content', async () => {
      const largeContent = Buffer.alloc(1000, 'a');
      const storage = createInMemoryStorage({
        'large.txt': largeContent,
      });

      const stats = await storage.stat('large.txt');
      expect(stats).toEqual({ size: 1000 });
    });

    it('should throw error when statting non-existing file', async () => {
      const storage = createInMemoryStorage();

      await expect(storage.stat('non-existent.txt')).rejects.toThrow(
        "File non-existent.txt doesn't exists",
      );
    });

    it('should return updated size after file modification', async () => {
      const storage = createInMemoryStorage({
        'file.txt': Buffer.from('small'),
      });

      let stats = await storage.stat('file.txt');
      expect(stats.size).toBe(5);

      await storage.writeFile('file.txt', Buffer.from('much longer content'));
      stats = await storage.stat('file.txt');
      expect(stats.size).toBe(19);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete file lifecycle', async () => {
      const storage = createInMemoryStorage();

      // Create file
      const content = Buffer.from('test content');
      await storage.writeFile('test.txt', content);
      expect(await storage.exists('test.txt')).toBe(true);

      // Read file
      const readContent = await storage.readFile('test.txt');
      expect(readContent).toEqual(content);

      // Check stats
      const stats = await storage.stat('test.txt');
      expect(stats.size).toBe(content.length);

      // Delete file
      await storage.delete('test.txt');
      expect(await storage.exists('test.txt')).toBe(false);
    });

    it('should handle complex directory structure', async () => {
      const storage = createInMemoryStorage({
        'root.txt': Buffer.from('root'),
        'dir1/file1.txt': Buffer.from('file1'),
        'dir1/file2.txt': Buffer.from('file2'),
        'dir1/subdir/file3.txt': Buffer.from('file3'),
        'dir2/file4.txt': Buffer.from('file4'),
      });

      // List root
      const rootFiles = await storage.list('');
      expect(rootFiles).toHaveLength(3);
      expect(rootFiles).toContainEqual({ name: 'root.txt', isDirectory: false });
      expect(rootFiles).toContainEqual({ name: 'dir1', isDirectory: true });
      expect(rootFiles).toContainEqual({ name: 'dir2', isDirectory: true });

      // List dir1
      const dir1Files = await storage.list('dir1/');
      expect(dir1Files).toHaveLength(3);
      expect(dir1Files).toContainEqual({ name: 'file1.txt', isDirectory: false });
      expect(dir1Files).toContainEqual({ name: 'file2.txt', isDirectory: false });
      expect(dir1Files).toContainEqual({ name: 'subdir', isDirectory: true });

      // Remove dir1
      await storage.rmdir('dir1');
      expect(await storage.exists('dir1/file1.txt')).toBe(false);
      expect(await storage.exists('dir1/file2.txt')).toBe(false);
      expect(await storage.exists('dir1/subdir/file3.txt')).toBe(false);
      expect(await storage.exists('root.txt')).toBe(true);
      expect(await storage.exists('dir2/file4.txt')).toBe(true);
    });

    it('should handle multiple write and delete operations', async () => {
      const storage = createInMemoryStorage();

      // Write multiple files
      await storage.writeFile('file1.txt', Buffer.from('content1'));
      await storage.writeFile('file2.txt', Buffer.from('content2'));
      await storage.writeFile('file3.txt', Buffer.from('content3'));

      expect(await storage.list('')).toHaveLength(3);

      // Delete one
      await storage.delete('file2.txt');
      expect(await storage.list('')).toHaveLength(2);
      expect(await storage.exists('file1.txt')).toBe(true);
      expect(await storage.exists('file2.txt')).toBe(false);
      expect(await storage.exists('file3.txt')).toBe(true);

      // Overwrite one
      await storage.writeFile('file1.txt', Buffer.from('updated content'));
      expect(await storage.readFile('file1.txt')).toEqual(Buffer.from('updated content'));

      // Delete all
      await storage.delete('file1.txt');
      await storage.delete('file3.txt');
      expect(await storage.list('')).toHaveLength(0);
    });
  });
});
