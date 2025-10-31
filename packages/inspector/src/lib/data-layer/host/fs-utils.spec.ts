import { describe, it, expect, beforeEach } from 'vitest';
import type { FileSystemInterface } from '../types';
import { createInMemoryStorage } from '../../logic/storage/in-memory';
import { createFileSystemInterface } from '../../logic/file-system-interface';
import { getFilesInDirectory } from './fs-utils';

describe('fs-utils', () => {
  describe('shouldIgnore patterns', () => {
    let fs: FileSystemInterface;

    beforeEach(async () => {
      // Create a simple in-memory file system with test files
      const storage = createInMemoryStorage({
        'test.log': Buffer.from('log content'),
        'test.txt': Buffer.from('text content'),
        'testing.js': Buffer.from('js content'),
        'test-file.js': Buffer.from('js content'),
        'node_modules/package.json': Buffer.from('{}'),
        'node_modules/lib/index.js': Buffer.from(''),
        '.git/config': Buffer.from(''),
        'my-temp-file.txt': Buffer.from(''),
        'temporary.js': Buffer.from(''),
        'error.log': Buffer.from(''),
        'debug.log': Buffer.from(''),
        'app.log': Buffer.from(''),
        'data.json': Buffer.from('{}'),
        'config.json': Buffer.from('{}'),
        'test-error.log': Buffer.from(''),
        'test-debug.log': Buffer.from(''),
        'prefix-file.txt': Buffer.from(''),
        'file-suffix.bak': Buffer.from(''),
        'regular-file.txt': Buffer.from(''),
      });
      fs = createFileSystemInterface(storage);
    });

    describe('Exact match patterns', () => {
      it('should ignore exact directory name "node_modules"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['node_modules']);
        expect(files).not.toContain('node_modules/package.json');
        expect(files).not.toContain('node_modules/lib/index.js');
      });

      it('should ignore exact directory name ".git"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['.git']);
        expect(files).not.toContain('.git/config');
      });

      it('should not ignore similar names when using exact match', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['test.log']);
        expect(files).not.toContain('test.log');
        expect(files).toContain('test.txt'); // Should still be there
        expect(files).toContain('testing.js'); // Should still be there
      });

      it('should ignore multiple exact matches', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, [
          'node_modules',
          '.git',
          'data.json',
        ]);
        expect(files).not.toContain('node_modules/package.json');
        expect(files).not.toContain('.git/config');
        expect(files).not.toContain('data.json');
        expect(files).toContain('config.json'); // Should still be there
      });
    });

    describe('Suffix match patterns (*.ext)', () => {
      it('should ignore all files ending with .log', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*.log']);
        expect(files).not.toContain('test.log');
        expect(files).not.toContain('error.log');
        expect(files).not.toContain('debug.log');
        expect(files).not.toContain('app.log');
        expect(files).not.toContain('test-error.log');
        expect(files).not.toContain('test-debug.log');
        expect(files).toContain('test.txt');
        expect(files).toContain('testing.js');
      });

      it('should ignore all files ending with .json', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*.json']);
        expect(files).not.toContain('data.json');
        expect(files).not.toContain('config.json');
        expect(files).toContain('test.txt');
      });

      it('should ignore all files ending with .bak', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*.bak']);
        expect(files).not.toContain('file-suffix.bak');
        expect(files).toContain('regular-file.txt');
      });
    });

    describe('Prefix match patterns (prefix*)', () => {
      it('should ignore all files starting with "test"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['test*']);
        expect(files).not.toContain('test.log');
        expect(files).not.toContain('test.txt');
        expect(files).not.toContain('testing.js');
        expect(files).not.toContain('test-file.js');
        expect(files).not.toContain('test-error.log');
        expect(files).not.toContain('test-debug.log');
        expect(files).toContain('my-temp-file.txt'); // Should still be there
      });

      it('should ignore all files starting with "prefix-"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['prefix-*']);
        expect(files).not.toContain('prefix-file.txt');
        expect(files).toContain('test.txt');
      });

      it('should ignore all files starting with "node"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['node*']);
        expect(files).not.toContain('node_modules/package.json');
        expect(files).not.toContain('node_modules/lib/index.js');
      });
    });

    describe('Contains match patterns (*pattern*)', () => {
      it('should ignore all files containing "temp"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*temp*']);
        expect(files).not.toContain('my-temp-file.txt');
        expect(files).not.toContain('temporary.js');
        expect(files).toContain('test.txt');
      });

      it('should ignore all files containing "error"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*error*']);
        expect(files).not.toContain('error.log');
        expect(files).not.toContain('test-error.log');
        expect(files).toContain('debug.log');
      });
    });

    describe('Complex patterns', () => {
      it('should ignore files matching "test-*.log"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['test-*.log']);
        expect(files).not.toContain('test-error.log');
        expect(files).not.toContain('test-debug.log');
        expect(files).toContain('test.log'); // Doesn't match the pattern
        expect(files).toContain('error.log'); // Doesn't match the pattern
        expect(files).toContain('test-file.js'); // Different extension
      });

      it('should ignore files matching "*-file.*"', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*-file.*']);
        expect(files).not.toContain('test-file.js');
        expect(files).not.toContain('my-temp-file.txt');
        expect(files).not.toContain('prefix-file.txt');
        expect(files).not.toContain('regular-file.txt'); // Also matches because it has -file.
        expect(files).toContain('test.txt'); // Doesn't match the pattern
      });
    });

    describe('Multiple patterns', () => {
      it('should ignore files matching any of multiple patterns', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, [
          '*.log',
          'test*',
          'node_modules',
          '.git',
        ]);
        // Should ignore all .log files
        expect(files).not.toContain('test.log');
        expect(files).not.toContain('error.log');
        expect(files).not.toContain('debug.log');
        // Should ignore all test* files
        expect(files).not.toContain('test.txt');
        expect(files).not.toContain('testing.js');
        // Should ignore directories
        expect(files).not.toContain('node_modules/package.json');
        expect(files).not.toContain('.git/config');
        // Should keep non-matching files
        expect(files).toContain('data.json');
        expect(files).toContain('config.json');
        expect(files).toContain('regular-file.txt');
      });

      it('should ignore files with combined prefix and suffix patterns', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['test*', '*.log', '*.json']);
        expect(files).not.toContain('test.log'); // Matches both test* and *.log
        expect(files).not.toContain('test.txt'); // Matches test*
        expect(files).not.toContain('error.log'); // Matches *.log
        expect(files).not.toContain('data.json'); // Matches *.json
        expect(files).toContain('regular-file.txt'); // Doesn't match any pattern
      });
    });

    describe('Edge cases', () => {
      it('should return all files when no patterns provided', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, []);
        expect(files.length).toBeGreaterThan(0);
        expect(files).toContain('test.log');
        expect(files).toContain('data.json');
      });

      it('should return empty array when all files are ignored', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*']);
        expect(files).toEqual([]);
      });

      it('should handle patterns with special regex characters', async () => {
        // Create a file with special characters
        const specialStorage = createInMemoryStorage({
          'file.with.dots.txt': Buffer.from('content'),
          'file[bracket].txt': Buffer.from('content'),
          'file(paren).txt': Buffer.from('content'),
          'normal.txt': Buffer.from('content'),
        });
        const specialFs = createFileSystemInterface(specialStorage);

        const files = await getFilesInDirectory(specialFs, '', [], true, ['file.with.dots.txt']);
        expect(files).not.toContain('file.with.dots.txt');
        expect(files).toContain('normal.txt');
      });

      it('should handle empty directory', async () => {
        const emptyStorage = createInMemoryStorage({});
        const emptyFs = createFileSystemInterface(emptyStorage);
        const files = await getFilesInDirectory(emptyFs, '', [], true, ['*.log']);
        expect(files).toEqual([]);
      });

      it('should handle non-existent directory gracefully', async () => {
        const files = await getFilesInDirectory(fs, 'non-existent-dir', [], true, []);
        expect(files).toEqual([]);
      });
    });

    describe('Recursive behavior with ignore patterns', () => {
      it('should apply ignore patterns recursively', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['*.log']);
        // Should ignore .log files in root
        expect(files).not.toContain('test.log');
        // Should ignore .log files in subdirectories
        expect(files).not.toContain('test-error.log');
        expect(files).not.toContain('test-debug.log');
      });

      it('should ignore directories and their contents', async () => {
        const files = await getFilesInDirectory(fs, '', [], true, ['node_modules', '.git']);
        expect(files).not.toContain('node_modules/package.json');
        expect(files).not.toContain('node_modules/lib/index.js');
        expect(files).not.toContain('.git/config');
      });

      it('should work with non-recursive search', async () => {
        const nestedStorage = createInMemoryStorage({
          'root.txt': Buffer.from(''),
          'dir/nested.txt': Buffer.from(''),
        });
        const nestedFs = createFileSystemInterface(nestedStorage);
        const files = await getFilesInDirectory(nestedFs, '', [], false, []);
        expect(files).toContain('root.txt');
        expect(files).not.toContain('dir/nested.txt'); // Non-recursive
      });
    });
  });

  describe('getFilesInDirectory basic functionality', () => {
    let fs: FileSystemInterface;

    beforeEach(() => {
      const storage = createInMemoryStorage({
        'file1.txt': Buffer.from('content1'),
        'file2.txt': Buffer.from('content2'),
        'dir1/file3.txt': Buffer.from('content3'),
        'dir1/file4.txt': Buffer.from('content4'),
        'dir1/nested/file5.txt': Buffer.from('content5'),
        'dir2/file6.txt': Buffer.from('content6'),
      });
      fs = createFileSystemInterface(storage);
    });

    it('should list all files recursively', async () => {
      const files = await getFilesInDirectory(fs, '', [], true, []);
      expect(files).toHaveLength(6);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).toContain('dir1/file3.txt');
      expect(files).toContain('dir1/file4.txt');
      expect(files).toContain('dir1/nested/file5.txt');
      expect(files).toContain('dir2/file6.txt');
    });

    it('should list files non-recursively', async () => {
      const files = await getFilesInDirectory(fs, '', [], false, []);
      // Should include root-level files only (not files in subdirectories)
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).not.toContain('dir1/file3.txt');
      expect(files).not.toContain('dir1/file4.txt');
      expect(files).not.toContain('dir1/nested/file5.txt');
      expect(files).not.toContain('dir2/file6.txt');
    });

    it('should list files from a specific directory', async () => {
      const files = await getFilesInDirectory(fs, 'dir1', [], true, []);
      expect(files).toHaveLength(3);
      expect(files).toContain('dir1/file3.txt');
      expect(files).toContain('dir1/file4.txt');
      expect(files).toContain('dir1/nested/file5.txt');
      expect(files).not.toContain('file1.txt');
    });

    it('should accumulate files in provided array', async () => {
      const accumulator: string[] = [];
      const result = await getFilesInDirectory(fs, '', accumulator, true, []);
      expect(result).toBe(accumulator);
      expect(accumulator).toHaveLength(6);
    });
  });
});
