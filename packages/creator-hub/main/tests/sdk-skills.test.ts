import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncProjectSkills } from '../src/modules/sdk-skills';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/modules/electron', () => ({
  getUserDataPath: vi.fn(() => '/unused-in-these-tests'),
}));

const MARKER_FILE = '.dcl-sdk-skills.json';

async function writeCache(cacheRoot: string, sha: string, skills: string[]): Promise<void> {
  await fs.rm(path.join(cacheRoot, 'skills'), { recursive: true, force: true });
  for (const name of skills) {
    const dir = path.join(cacheRoot, 'skills', name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), `# ${name} @ ${sha}\n`);
  }
  await fs.mkdir(cacheRoot, { recursive: true });
  await fs.writeFile(
    path.join(cacheRoot, 'meta.json'),
    JSON.stringify({ sha, fetchedAt: Date.now() }),
  );
}

async function readMarker(projectPath: string): Promise<{ sha: string; skills: string[] }> {
  const raw = await fs.readFile(path.join(projectPath, '.agents', 'skills', MARKER_FILE), 'utf8');
  return JSON.parse(raw);
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

describe('syncProjectSkills', () => {
  let tmpRoot: string;
  let cacheRoot: string;
  let projectPath: string;
  let projectSkillsDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-skills-test-'));
    cacheRoot = path.join(tmpRoot, 'cache');
    projectPath = path.join(tmpRoot, 'project');
    projectSkillsDir = path.join(projectPath, '.agents', 'skills');
    await fs.mkdir(projectPath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  describe('when the project has no skills installed yet', () => {
    beforeEach(async () => {
      await writeCache(cacheRoot, 'sha-1', ['create-scene', 'composites']);
    });

    it('should install the cached skills into .agents/skills and write the marker', async () => {
      const result = await syncProjectSkills(cacheRoot, projectPath);

      expect(result).toBe(true);
      expect(await listDirs(projectSkillsDir)).toEqual(['composites', 'create-scene']);
      await expect(
        fs.readFile(path.join(projectSkillsDir, 'create-scene', 'SKILL.md'), 'utf8'),
      ).resolves.toContain('create-scene @ sha-1');
      expect(await readMarker(projectPath)).toEqual({
        sha: 'sha-1',
        skills: ['composites', 'create-scene'],
      });
    });
  });

  describe('when the marker sha matches the cache sha', () => {
    beforeEach(async () => {
      await writeCache(cacheRoot, 'sha-1', ['create-scene']);
      await syncProjectSkills(cacheRoot, projectPath);
      // Tamper with an installed file so a rewrite would be observable.
      await fs.writeFile(path.join(projectSkillsDir, 'create-scene', 'SKILL.md'), 'user edit\n');
    });

    it('should be a no-op and leave the installed files untouched', async () => {
      const result = await syncProjectSkills(cacheRoot, projectPath);

      expect(result).toBe(true);
      await expect(
        fs.readFile(path.join(projectSkillsDir, 'create-scene', 'SKILL.md'), 'utf8'),
      ).resolves.toBe('user edit\n');
    });
  });

  describe('when the cache sha changed since the last sync', () => {
    beforeEach(async () => {
      await writeCache(cacheRoot, 'sha-1', ['create-scene', 'removed-upstream']);
      await syncProjectSkills(cacheRoot, projectPath);
      await writeCache(cacheRoot, 'sha-2', ['create-scene', 'brand-new']);
    });

    it('should update owned skills, remove stale ones, and rewrite the marker', async () => {
      const result = await syncProjectSkills(cacheRoot, projectPath);

      expect(result).toBe(true);
      expect(await listDirs(projectSkillsDir)).toEqual(['brand-new', 'create-scene']);
      await expect(
        fs.readFile(path.join(projectSkillsDir, 'create-scene', 'SKILL.md'), 'utf8'),
      ).resolves.toContain('create-scene @ sha-2');
      expect(await readMarker(projectPath)).toEqual({
        sha: 'sha-2',
        skills: ['brand-new', 'create-scene'],
      });
    });
  });

  describe('when the user added their own skill directory', () => {
    beforeEach(async () => {
      await writeCache(cacheRoot, 'sha-1', ['create-scene']);
      await syncProjectSkills(cacheRoot, projectPath);
      const userSkillDir = path.join(projectSkillsDir, 'my-custom-skill');
      await fs.mkdir(userSkillDir, { recursive: true });
      await fs.writeFile(path.join(userSkillDir, 'SKILL.md'), '# mine\n');
      await writeCache(cacheRoot, 'sha-2', ['create-scene']);
    });

    it('should never touch the user-added directory across updates', async () => {
      const result = await syncProjectSkills(cacheRoot, projectPath);

      expect(result).toBe(true);
      expect(await listDirs(projectSkillsDir)).toEqual(['create-scene', 'my-custom-skill']);
      await expect(
        fs.readFile(path.join(projectSkillsDir, 'my-custom-skill', 'SKILL.md'), 'utf8'),
      ).resolves.toBe('# mine\n');
      expect((await readMarker(projectPath)).skills).toEqual(['create-scene']);
    });
  });

  describe('when the cache is empty or missing', () => {
    it('should return false and leave the project untouched', async () => {
      const result = await syncProjectSkills(cacheRoot, projectPath);

      expect(result).toBe(false);
      await expect(fs.stat(projectSkillsDir)).rejects.toThrow();
    });
  });
});
