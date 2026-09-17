import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveWithin } from '../../src/services/fs';

describe('resolveWithin', () => {
  let base: string;
  let outside: string;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resolve-within-'));
    base = path.join(root, 'project');
    outside = path.join(root, 'outside');
    await fs.mkdir(path.join(base, 'assets', 'scene'), { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(base), { recursive: true, force: true });
  });

  describe('when given a path inside the base directory', () => {
    it('should resolve a nested relative path', async () => {
      await expect(resolveWithin(base, 'assets/scene/main.composite')).resolves.toBe(
        path.join(base, 'assets', 'scene', 'main.composite'),
      );
    });

    it('should resolve a file that does not exist yet', async () => {
      await expect(resolveWithin(base, 'bin/index.js')).resolves.toBe(
        path.join(base, 'bin', 'index.js'),
      );
    });

    it('should treat an empty path as the base directory itself', async () => {
      await expect(resolveWithin(base, '')).resolves.toBe(base);
    });

    it('should treat "." as the base directory itself', async () => {
      await expect(resolveWithin(base, '.')).resolves.toBe(base);
    });

    it('should allow a relative path that stays inside the base', async () => {
      await expect(resolveWithin(base, 'assets/../scene.json')).resolves.toBe(
        path.join(base, 'scene.json'),
      );
    });
  });

  describe('when given a path outside the base directory', () => {
    it('should reject an absolute path', async () => {
      await expect(resolveWithin(base, '/etc/passwd')).rejects.toThrow('not relative');
    });

    it('should reject a path above the base', async () => {
      await expect(resolveWithin(base, '../outside/secret.txt')).rejects.toThrow('outside');
    });

    it('should reject a path far above the base', async () => {
      await expect(resolveWithin(base, '../../../../../../etc/passwd')).rejects.toThrow('outside');
    });

    it('should reject a sibling directory sharing the base as a string prefix', async () => {
      await fs.mkdir(`${base}-other`, { recursive: true });
      await expect(resolveWithin(base, '../project-other/x.txt')).rejects.toThrow('outside');
    });
  });

  describe('when the path traverses a symlink pointing outside the base', () => {
    beforeEach(async () => {
      await fs.symlink(outside, path.join(base, 'link'));
    });

    it('should reject reaching a file through the symlink', async () => {
      await expect(resolveWithin(base, 'link/secret.txt')).rejects.toThrow('outside');
    });

    it('should reject the symlink itself', async () => {
      await expect(resolveWithin(base, 'link')).rejects.toThrow('outside');
    });

    // The create case: the target has no realpath of its own yet, so only canonicalizing
    // the target itself would let these through.
    it('should reject a file that does not exist yet through the symlink', async () => {
      await expect(resolveWithin(base, 'link/new-file.txt')).rejects.toThrow('outside');
    });

    it('should reject a directory that does not exist yet through the symlink', async () => {
      await expect(resolveWithin(base, 'link/newdir')).rejects.toThrow('outside');
    });

    it('should reject a deep path that does not exist yet through the symlink', async () => {
      await expect(resolveWithin(base, 'link/a/b/c.txt')).rejects.toThrow('outside');
    });
  });

  describe('when the path is a symlink whose own target does not exist', () => {
    // `realpath` reports ENOENT for this exactly as it does for an absent path, so a walk
    // that climbs past it loses the redirect — while `writeFile` and `mkdir` follow it.
    beforeEach(async () => {
      await fs.mkdir(path.join(outside, 'nested'), { recursive: true });
      await fs.symlink(path.join(outside, 'nested', 'target.txt'), path.join(base, 'link.txt'));
    });

    it('should reject it even though the target does not exist', async () => {
      await expect(resolveWithin(base, 'link.txt')).rejects.toThrow('broken symbolic link');
    });

    it('should not let a write reach the symlink target', async () => {
      const target = path.join(outside, 'nested', 'target.txt');

      await expect(resolveWithin(base, 'link.txt')).rejects.toThrow();

      await expect(fs.access(target)).rejects.toThrow();
    });
  });

  describe('when a path inside the base does not exist yet', () => {
    it('should still allow it', async () => {
      await expect(resolveWithin(base, 'assets/scene/brand-new.composite')).resolves.toBe(
        path.join(base, 'assets', 'scene', 'brand-new.composite'),
      );
    });

    it('should allow a whole new directory tree', async () => {
      await expect(resolveWithin(base, 'a/b/c/d.txt')).resolves.toBe(
        path.join(base, 'a', 'b', 'c', 'd.txt'),
      );
    });
  });
});
