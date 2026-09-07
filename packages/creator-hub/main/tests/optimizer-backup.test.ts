import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  OPTIMIZE_DIR,
  backupFile,
  createManifest,
  ensureDclignoreBlock,
  hasBackup,
  readManifest,
  revertFromManifest,
  stashFile,
  stripDclignoreBlock,
  writeManifest,
} from '../src/modules/optimizer/backup';

async function write(file: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

describe('optimizer backup', () => {
  let project: string;

  beforeEach(async () => {
    project = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-backup-'));
  });
  afterEach(async () => {
    await fs.rm(project, { recursive: true, force: true });
  });

  describe('.dclignore block', () => {
    it('should create the file with the block when there is none', async () => {
      await ensureDclignoreBlock(project);

      const text = await fs.readFile(path.join(project, '.dclignore'), 'utf8');
      expect(text).toContain('# --- creator-hub optimize backup');
      expect(text).toContain(`\n${OPTIMIZE_DIR}\n${OPTIMIZE_DIR}/**\n`);
    });

    it('should append once to an existing file, even one without a trailing newline', async () => {
      await write(path.join(project, '.dclignore'), 'node_modules\n*.ts');

      await ensureDclignoreBlock(project);
      await ensureDclignoreBlock(project);

      const text = await fs.readFile(path.join(project, '.dclignore'), 'utf8');
      expect(text.startsWith('node_modules\n*.ts\n# ---')).toBe(true);
      expect(text.match(/creator-hub optimize backup/g)).toHaveLength(1);
    });

    it('should strip only its own block and keep the creator’s entries', async () => {
      await write(path.join(project, '.dclignore'), 'node_modules\n**/sakura*\n');
      await ensureDclignoreBlock(project);

      await stripDclignoreBlock(project);

      expect(await fs.readFile(path.join(project, '.dclignore'), 'utf8')).toBe(
        'node_modules\n**/sakura*\n',
      );
    });

    it('should delete the file when the block was all it held', async () => {
      await ensureDclignoreBlock(project);
      await stripDclignoreBlock(project);
      expect(await exists(path.join(project, '.dclignore'))).toBe(false);
    });
  });

  describe('backupFile', () => {
    it('should keep the first copy across repeated calls', async () => {
      await write(path.join(project, 'assets/a.glb'), 'pristine');
      await backupFile(project, 'assets/a.glb');

      await write(path.join(project, 'assets/a.glb'), 'optimized once');
      await backupFile(project, 'assets/a.glb');

      const backup = path.join(project, OPTIMIZE_DIR, 'backup/assets/a.glb');
      expect(await fs.readFile(backup, 'utf8')).toBe('pristine');
    });
  });

  describe('stashFile', () => {
    it('should move the file into the backup and off the project', async () => {
      await write(path.join(project, 'assets/tex.png'), 'pixels');

      await stashFile(project, 'assets/tex.png');

      expect(await exists(path.join(project, 'assets/tex.png'))).toBe(false);
      expect(
        await fs.readFile(path.join(project, OPTIMIZE_DIR, 'backup/assets/tex.png'), 'utf8'),
      ).toBe('pixels');
    });
  });

  describe('manifest', () => {
    it('should round-trip and report a backup once written', async () => {
      expect(await hasBackup(project)).toBe(false);
      const manifest = createManifest();
      manifest.modifiedGlbs.push('a.glb');
      manifest.createdFiles.push('optimized-textures/t.png');
      manifest.removedFiles.push('assets/old.png');

      await writeManifest(project, manifest);

      expect(await hasBackup(project)).toBe(true);
      expect(await readManifest(project)).toEqual(manifest);
    });

    it('should default removedFiles for a manifest written before the field existed', async () => {
      await write(
        path.join(project, OPTIMIZE_DIR, 'manifest.json'),
        JSON.stringify({ version: 1, createdAt: 1, modifiedGlbs: ['a.glb'], createdFiles: [] }),
      );

      const manifest = await readManifest(project);

      expect(manifest?.removedFiles).toEqual([]);
      expect(manifest?.modifiedGlbs).toEqual(['a.glb']);
    });

    it('should return null when there is no manifest', async () => {
      expect(await readManifest(project)).toBeNull();
    });
  });

  describe('revertFromManifest', () => {
    it('should restore modified and removed files, delete created ones, and clean up', async () => {
      await write(path.join(project, 'models/a.glb'), 'original a');
      await write(path.join(project, 'models/b.glb'), 'original b');
      await write(path.join(project, 'models/shared.png'), 'original png');
      await write(path.join(project, 'src/ui.ts'), 'untouched');
      await ensureDclignoreBlock(project);

      await backupFile(project, 'models/a.glb');
      await backupFile(project, 'models/b.glb');
      await write(path.join(project, 'models/a.glb'), 'optimized a');
      await write(path.join(project, 'models/b.glb'), 'optimized b');
      await write(path.join(project, 'optimized-textures/shared.png'), 'sidecar');
      await stashFile(project, 'models/shared.png');

      const manifest = createManifest();
      manifest.modifiedGlbs.push('models/a.glb', 'models/b.glb');
      manifest.createdFiles.push('optimized-textures/shared.png');
      manifest.removedFiles.push('models/shared.png');
      await writeManifest(project, manifest);

      const restored = await revertFromManifest(project, manifest);

      expect(restored).toBe(2);
      expect(await fs.readFile(path.join(project, 'models/a.glb'), 'utf8')).toBe('original a');
      expect(await fs.readFile(path.join(project, 'models/b.glb'), 'utf8')).toBe('original b');
      expect(await fs.readFile(path.join(project, 'models/shared.png'), 'utf8')).toBe(
        'original png',
      );
      expect(await exists(path.join(project, 'optimized-textures/shared.png'))).toBe(false);
      expect(await fs.readFile(path.join(project, 'src/ui.ts'), 'utf8')).toBe('untouched');
      expect(await exists(path.join(project, OPTIMIZE_DIR))).toBe(false);
      expect(await exists(path.join(project, '.dclignore'))).toBe(false);
    });

    it('should skip entries whose backup is missing instead of failing', async () => {
      await write(path.join(project, 'models/a.glb'), 'still optimized');
      const manifest = createManifest();
      manifest.modifiedGlbs.push('models/a.glb');
      manifest.removedFiles.push('models/gone.png');

      const restored = await revertFromManifest(project, manifest);

      expect(restored).toBe(0);
      expect(await fs.readFile(path.join(project, 'models/a.glb'), 'utf8')).toBe('still optimized');
    });
  });
});
