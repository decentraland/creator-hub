import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectSkillsStatus,
  linkSkillsIntoProject,
  unlinkSkillsFromProject,
} from '../src/modules/skills';

const noop = () => {};
const tmpDirs: string[] = [];

// A fake cache with two skills, plus an empty project dir.
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
  tmpDirs.push(root);
  const cache = path.join(root, 'cache', 'skills');
  fs.mkdirSync(path.join(cache, 'skill-a'), { recursive: true });
  fs.mkdirSync(path.join(cache, 'skill-b'), { recursive: true });
  fs.writeFileSync(path.join(cache, 'skill-a', 'SKILL.md'), '# a');
  fs.writeFileSync(path.join(cache, 'skill-b', 'SKILL.md'), '# b');
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  return { cache, project };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('linkSkillsIntoProject', () => {
  it('symlinks the cache into .claude/skills and .agents/skills, and gitignores it', () => {
    const { cache, project } = setup();
    linkSkillsIntoProject(project, cache, noop);

    for (const agentDir of ['.claude', '.agents']) {
      const link = path.join(project, agentDir, 'skills');
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(fs.readdirSync(link).sort()).toEqual(['skill-a', 'skill-b']);
      const gitignore = fs.readFileSync(path.join(project, agentDir, '.gitignore'), 'utf8');
      expect(gitignore.split('\n')).toContain('skills');
    }
  });

  it('is idempotent — a second run repoints without throwing', () => {
    const { cache, project } = setup();
    linkSkillsIntoProject(project, cache, noop);
    expect(() => linkSkillsIntoProject(project, cache, noop)).not.toThrow();
    expect(fs.lstatSync(path.join(project, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('repoints its own links on later runs without logging a failure', () => {
    // linkSkillsIntoProject catches and logs, so "doesn't throw" can't see a failed relink.
    const { cache, project } = setup();
    const logged: string[] = [];
    linkSkillsIntoProject(project, cache, msg => logged.push(msg));
    linkSkillsIntoProject(project, cache, msg => logged.push(msg));
    expect(logged.filter(msg => msg.startsWith('could not link'))).toEqual([]);
    expect(
      fs.readFileSync(path.join(project, '.claude', 'skills', 'skill-a', 'SKILL.md'), 'utf8'),
    ).toBe('# a');
  });

  it('merges into a user-owned real skills dir without touching their skills', () => {
    const { cache, project } = setup();
    // The user already keeps their own .claude/skills with a hand-written skill.
    const userSkills = path.join(project, '.claude', 'skills');
    fs.mkdirSync(path.join(userSkills, 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(userSkills, 'my-skill', 'SKILL.md'), '# mine');

    linkSkillsIntoProject(project, cache, noop);

    // Their real skill is untouched (still a directory, not a symlink).
    expect(fs.lstatSync(path.join(userSkills, 'my-skill')).isSymbolicLink()).toBe(false);
    // Ours are injected as symlinks alongside it.
    expect(fs.lstatSync(path.join(userSkills, 'skill-a')).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(userSkills, 'skill-b')).isSymbolicLink()).toBe(true);
  });

  it('leaves a user-made skills symlink of their own alone', () => {
    const { cache, project } = setup();
    // The user symlinked .agents/skills at their own checkout elsewhere.
    const theirCheckout = path.join(path.dirname(cache), 'their-skills');
    fs.mkdirSync(theirCheckout, { recursive: true });
    fs.mkdirSync(path.join(project, '.agents'), { recursive: true });
    fs.symlinkSync(theirCheckout, path.join(project, '.agents', 'skills'), 'dir');

    linkSkillsIntoProject(project, cache, noop);

    // Still points at their checkout, not our cache.
    const resolved = fs.realpathSync(path.join(project, '.agents', 'skills'));
    expect(resolved).toBe(fs.realpathSync(theirCheckout));
  });
});

// A scene whose skills-lock.json lists decentraland/sdk-skills, written `lockAgeMs` ago.
function setupInstalledScene(lockAgeMs = 0) {
  const { project } = setup();
  const lockPath = path.join(project, 'skills-lock.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      version: 1,
      skills: { 'decentraland-sdk-skills': { source: 'decentraland/sdk-skills' } },
    }),
  );
  const mtime = new Date(Date.now() - lockAgeMs);
  fs.utimesSync(lockPath, mtime, mtime);
  return { project, lockPath };
}

function readProjectInfo(project: string) {
  return JSON.parse(fs.readFileSync(path.join(project, '.editor', 'project.json'), 'utf8'));
}

function writeProjectInfo(project: string, info: object) {
  fs.mkdirSync(path.join(project, '.editor'), { recursive: true });
  fs.writeFileSync(path.join(project, '.editor', 'project.json'), JSON.stringify(info));
}

// GitHub: `latestSha` is main's head; `commitsSince` is what `commits?since=` returns.
function stubGitHub({
  latestSha,
  commitsSince = [],
}: {
  latestSha: string;
  commitsSince?: unknown[];
}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/commits/main')) return new Response(latestSha);
    if (url.includes('/commits?')) return new Response(JSON.stringify(commitsSince));
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getProjectSkillsStatus', () => {
  it('reports nothing installed when the scene has no skills lock', async () => {
    const { project } = setup();
    const fetchMock = stubGitHub({ latestSha: 'abc' });
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: false,
      outdated: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a lock that only lists skills from other repos', async () => {
    const { project } = setup();
    fs.writeFileSync(
      path.join(project, 'skills-lock.json'),
      JSON.stringify({ skills: { figma: { source: 'figma/mcp-server-guide' } } }),
    );
    stubGitHub({ latestSha: 'abc' });
    expect((await getProjectSkillsStatus(project, noop)).installed).toBe(false);
  });

  describe('when Creator Hub has no recorded commit for the scene', () => {
    it('is outdated when main has commits newer than the lock', async () => {
      const { project } = setupInstalledScene(60_000);
      stubGitHub({ latestSha: 'new', commitsSince: [{ sha: 'new' }] });
      expect(await getProjectSkillsStatus(project, noop)).toEqual({
        installed: true,
        outdated: true,
      });
    });

    it('records the latest commit as the baseline when nothing landed since the lock', async () => {
      const { project } = setupInstalledScene(60_000);
      stubGitHub({ latestSha: 'head', commitsSince: [] });
      expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
      expect(readProjectInfo(project).sdkSkills.sha).toBe('head');
    });
  });

  describe('when Creator Hub recorded a commit after the lock was written', () => {
    it('is outdated once main moves past the recorded commit', async () => {
      const { project } = setupInstalledScene(60_000);
      writeProjectInfo(project, { sdkSkills: { sha: 'old', recordedAt: Date.now() } });
      const fetchMock = stubGitHub({ latestSha: 'new' });
      expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
      expect(fetchMock.mock.calls.some(([url]) => url.includes('/commits?'))).toBe(false);
    });

    it('is up to date while main is still at the recorded commit', async () => {
      const { project } = setupInstalledScene(60_000);
      writeProjectInfo(project, { sdkSkills: { sha: 'same', recordedAt: Date.now() } });
      stubGitHub({ latestSha: 'same' });
      expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
    });
  });

  it('falls back to the lock time when the creator re-ran `skills add` after our record', async () => {
    const { project } = setupInstalledScene(0);
    writeProjectInfo(project, { sdkSkills: { sha: 'old', recordedAt: Date.now() - 60_000 } });
    stubGitHub({ latestSha: 'new', commitsSince: [] });
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
    expect(readProjectInfo(project).sdkSkills.sha).toBe('new');
  });

  it('reads as up to date when GitHub cannot be reached', async () => {
    const { project } = setupInstalledScene(60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: true,
      outdated: false,
    });
  });
});

describe('unlinkSkillsFromProject', () => {
  it('removes the links Creator Hub made, whole-dir and per-skill, and nothing else', () => {
    const { cache, project } = setup();
    linkSkillsIntoProject(project, cache, noop); // whole-dir links into both agent dirs
    // .agents/skills becomes a real dir with a user skill next to one of our per-skill links.
    fs.unlinkSync(path.join(project, '.agents', 'skills'));
    const agentsSkills = path.join(project, '.agents', 'skills');
    fs.mkdirSync(path.join(agentsSkills, 'my-skill'), { recursive: true });
    fs.symlinkSync(path.join(cache, 'skill-a'), path.join(agentsSkills, 'skill-a'), 'dir');

    unlinkSkillsFromProject(project, cache);

    expect(fs.existsSync(path.join(project, '.claude', 'skills'))).toBe(false);
    expect(fs.readdirSync(agentsSkills)).toEqual(['my-skill']);
    expect(fs.readdirSync(cache).sort()).toEqual(['skill-a', 'skill-b']);
  });
});
