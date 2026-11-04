import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { run } from '../src/modules/bin';
import {
  ensureSkillsCache,
  ensureSkillsLinked,
  getProjectSkillsStatus,
  linkSkillsIntoProject,
  unlinkSkillsFromProject,
  updateProjectSkills,
} from '../src/modules/skills';

// Read only when a test runs, after this is initialized (the mock factory itself is hoisted).
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-userdata-'));
vi.mock('electron', () => ({
  app: { getPath: () => userData, getVersion: () => '1.0.0' },
}));
vi.mock('../src/modules/bin', () => ({ run: vi.fn() }));

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

const APP_VERSION = '1.0.0';

// A scene whose skills-lock.json lists the given decentraland/sdk-skills folders and hashes,
// with those skills in .agents/skills as `skills add` leaves them.
function setupInstalledScene(installed: Record<string, string>) {
  const { cache, project } = setup();
  for (const folder of Object.keys(installed)) {
    fs.mkdirSync(path.join(project, '.agents', 'skills', folder), { recursive: true });
    fs.writeFileSync(path.join(project, '.agents', 'skills', folder, 'SKILL.md'), '# skill');
  }
  const skills = Object.fromEntries(
    Object.entries(installed).map(([folder, computedHash]) => [
      folder,
      { source: 'decentraland/sdk-skills', skillPath: `${folder}/SKILL.md`, computedHash },
    ]),
  );
  fs.writeFileSync(path.join(project, 'skills-lock.json'), JSON.stringify({ version: 1, skills }));
  return { cache, project };
}

// The app's skills cache, as built from upstream commit `sha` with these skill hashes.
function seedCache(sha: string, hashes: Record<string, string[]>) {
  const cacheDir = path.join(userData, 'sdk-skills');
  fs.mkdirSync(path.join(cacheDir, 'skills'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'meta.json'),
    JSON.stringify({ sha, appVersion: APP_VERSION, hashes }),
  );
}

function stubLatestSha(latestSha: string) {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes('/commits/main') ? new Response(latestSha) : new Response('', { status: 404 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getProjectSkillsStatus', () => {
  afterEach(() => fs.rmSync(path.join(userData, 'sdk-skills'), { recursive: true, force: true }));

  it('reports an install due when the scene has no skills lock', async () => {
    const { project } = setup();
    seedCache('head', { 'skill-a': ['h-a'] });
    stubLatestSha('head');
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: false,
      outdated: true,
    });
  });

  it("reports nothing to do for a scene without skills when GitHub can't be reached", async () => {
    const { project } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: false,
      outdated: false,
    });
  });

  it("stops offering an install that already ran and didn't leave a lock", async () => {
    const { project } = setup();
    seedCache('head', { 'skill-a': ['h-a'] });
    stubLatestSha('head');
    vi.mocked(run).mockReturnValue({
      wait: async () => Buffer.from(''),
    } as unknown as ReturnType<typeof run>);
    await updateProjectSkills(project, noop); // the stub writes no lock
    vi.mocked(run).mockReset();
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
  });

  it('ignores a lock that only lists skills from other repos', async () => {
    const { project } = setup();
    fs.writeFileSync(
      path.join(project, 'skills-lock.json'),
      JSON.stringify({ skills: { figma: { source: 'figma/mcp-server-guide' } } }),
    );
    stubLatestSha('abc');
    expect((await getProjectSkillsStatus(project, noop)).installed).toBe(false);
  });

  it('is up to date when every upstream skill is in the lock with the same hash', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a', 'skill-b': 'h-b' });
    seedCache('head', { 'skill-a': ['h-a'], 'skill-b': ['h-b'] });
    stubLatestSha('head');
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: true,
      outdated: false,
    });
  });

  it('accepts the hash a CRLF checkout (Windows) records', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a-crlf' });
    seedCache('head', { 'skill-a': ['h-a', 'h-a-crlf'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
  });

  it('is outdated when an upstream skill changed', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'old', 'skill-b': 'h-b' });
    seedCache('head', { 'skill-a': ['new'], 'skill-b': ['h-b'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
  });

  it('is outdated when a skill was published upstream after the install', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a' });
    seedCache('head', { 'skill-a': ['h-a'], 'report-sdk-issue': ['h-r'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
  });

  it("doesn't ask for the skills whose flow Creator Hub owns", async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a' });
    seedCache('head', { 'skill-a': ['h-a'], 'deploy-scene': ['h-d'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
  });

  it('still keeps one of those up to date when the creator installed it', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a', 'deploy-scene': 'old' });
    seedCache('head', { 'skill-a': ['h-a'], 'deploy-scene': ['h-d'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
  });

  it('is outdated when the lock is there but the skills folders are not (a fresh clone)', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a' });
    fs.rmSync(path.join(project, '.agents'), { recursive: true });
    // Creator Hub's own link into the cache doesn't count as the scene having the skills.
    const cacheSkills = path.join(userData, 'sdk-skills', 'skills');
    seedCache('head', { 'skill-a': ['h-a'] });
    fs.mkdirSync(path.join(cacheSkills, 'skill-a'), { recursive: true });
    fs.writeFileSync(path.join(cacheSkills, 'skill-a', 'SKILL.md'), '# a');
    linkSkillsIntoProject(project, cacheSkills, noop);
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
  });

  it('stops offering an update that already ran and did not help', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'old' });
    seedCache('head', { 'skill-a': ['new'] });
    stubLatestSha('head');
    vi.mocked(run).mockReturnValue({
      wait: async () => Buffer.from(''),
    } as unknown as ReturnType<typeof run>);
    await updateProjectSkills(project, noop); // the stub leaves the lock as it was
    vi.mocked(run).mockReset();
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
  });

  it('ignores lock entries for skills removed upstream', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a', retired: 'h-x' });
    seedCache('head', { 'skill-a': ['h-a'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(false);
  });

  it('is outdated for a lock from the old single-skill layout', async () => {
    const { project } = setup();
    fs.writeFileSync(
      path.join(project, 'skills-lock.json'),
      JSON.stringify({
        skills: {
          'decentraland-sdk-skills': {
            source: 'decentraland/sdk-skills',
            skillPath: 'SKILL.md',
            computedHash: 'h-root',
          },
        },
      }),
    );
    seedCache('head', { 'skill-a': ['h-a'] });
    stubLatestSha('head');
    expect((await getProjectSkillsStatus(project, noop)).outdated).toBe(true);
  });

  it('reads as up to date while the cache is not yet at upstream main', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a' });
    seedCache('older', { 'skill-a': ['other'] });
    // The refresh can't download a tarball here, so the cache stays at `older`.
    stubLatestSha('head');
    expect(await getProjectSkillsStatus(project, noop)).toEqual({
      installed: true,
      outdated: false,
    });
  });

  it('reads as up to date when GitHub cannot be reached', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a' });
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

describe('ensureSkillsCache', () => {
  it("records each upstream skill's hash as the skills CLI computes it, LF and CRLF", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-repo-'));
    tmpDirs.push(root);
    const repo = path.join(root, 'sdk-skills-head');
    fs.mkdirSync(path.join(repo, 'skill-a', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'skill-a', 'SKILL.md'), '# a\nline\n');
    fs.writeFileSync(path.join(repo, 'skill-a', 'scripts', 'exact.mjs'), 'x\n');
    fs.writeFileSync(path.join(repo, '.gitattributes'), 'skill-a/scripts/exact.mjs -text\n');
    const tarball = path.join(root, 'repo.tar.gz');
    execFileSync('tar', ['-czf', tarball, '-C', root, 'sdk-skills-head'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' }, // no macOS ._ metadata files
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/commits/main')
          ? new Response('head')
          : new Response(fs.readFileSync(tarball)),
      ),
    );
    const cacheDir = path.join(root, 'cache');

    await ensureSkillsCache(cacheDir, APP_VERSION, noop);

    const sha256 = (...parts: string[]) => {
      const hash = crypto.createHash('sha256');
      for (const part of parts) hash.update(part);
      return hash.digest('hex');
    };
    const meta = JSON.parse(fs.readFileSync(path.join(cacheDir, 'meta.json'), 'utf8'));
    // localeCompare order, as the CLI sorts: `scripts/` before `SKILL.md`, unlike ASCII.
    expect(meta.hashes['skill-a']).toEqual([
      sha256('scripts/exact.mjs', 'x\n', 'SKILL.md', '# a\nline\n'),
      sha256('scripts/exact.mjs', 'x\n', 'SKILL.md', '# a\r\nline\r\n'),
    ]);
  });
});

describe('ensureSkillsCache line endings', () => {
  it('leaves files git would not convert byte-exact in the CRLF hash', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-repo-'));
    tmpDirs.push(root);
    const repo = path.join(root, 'sdk-skills-head');
    fs.mkdirSync(path.join(repo, 'skill-a', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'skill-a', 'SKILL.md'), '# a\n');
    fs.writeFileSync(path.join(repo, 'skill-a', 'scripts', 'gen.mjs'), 'x\n'); // glob below
    fs.writeFileSync(path.join(repo, 'skill-a', 'scripts', 'mixed.txt'), 'a\r\nb\n'); // has a CR
    fs.writeFileSync(path.join(repo, '.gitattributes'), '*.mjs -text\n');
    const tarball = path.join(root, 'repo.tar.gz');
    execFileSync('tar', ['-czf', tarball, '-C', root, 'sdk-skills-head'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fs.readFileSync(tarball))),
    );
    const cacheDir = path.join(root, 'cache');

    await ensureSkillsCache(cacheDir, APP_VERSION, noop, 'head'); // SHA already known: no call

    const sha256 = (...parts: string[]) => {
      const hash = crypto.createHash('sha256');
      for (const part of parts) hash.update(part);
      return hash.digest('hex');
    };
    const meta = JSON.parse(fs.readFileSync(path.join(cacheDir, 'meta.json'), 'utf8'));
    expect(meta.hashes['skill-a'][1]).toBe(
      sha256('scripts/gen.mjs', 'x\n', 'scripts/mixed.txt', 'a\r\nb\n', 'SKILL.md', '# a\r\n'),
    );
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('codeload.github.com'),
    ]);
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

  it('takes back the .gitignore lines it added, so the installed skills can be committed', () => {
    const { cache, project } = setup();
    fs.mkdirSync(path.join(project, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(project, '.agents', '.gitignore'), 'notes.md\n');
    linkSkillsIntoProject(project, cache, noop);

    unlinkSkillsFromProject(project, cache);

    expect(fs.existsSync(path.join(project, '.claude', '.gitignore'))).toBe(false);
    expect(fs.readFileSync(path.join(project, '.agents', '.gitignore'), 'utf8')).toBe('notes.md\n');
  });
});

describe('updateProjectSkills', () => {
  function stubSkillsCli(wait: () => Promise<unknown>, kill = vi.fn(async () => {})) {
    vi.mocked(run).mockReturnValue({ wait, kill } as unknown as ReturnType<typeof run>);
    return kill;
  }

  beforeEach(() => {
    seedCache('head', { 'skill-a': ['h-a'], 'skill-b': ['h-b'], 'deploy-scene': ['h-d'] });
    stubLatestSha('head');
  });
  afterEach(() => {
    vi.mocked(run).mockReset();
    vi.useRealTimers();
    fs.rmSync(path.join(userData, 'sdk-skills'), { recursive: true, force: true });
  });

  it('runs a pinned `skills add` for Claude Code and the shared .agents folder only', async () => {
    const { project } = setup();
    stubSkillsCli(async () => Buffer.from(''));

    await updateProjectSkills(project, noop);

    const { args, cwd, env } = vi.mocked(run).mock.calls[0][2]!;
    expect(cwd).toBe(project);
    expect(args!.slice(0, 4)).toEqual(['--yes', 'skills@1.7.4', 'add', 'decentraland/sdk-skills']);
    expect(args!.slice(args!.indexOf('--agent') + 1, args!.indexOf('-y'))).toEqual([
      'claude-code',
      'codex',
    ]);
    expect(args).not.toContain('--all');
    expect(env).toEqual(expect.objectContaining({ DO_NOT_TRACK: '1' }));
  });

  it('names every upstream skill except the ones whose flow Creator Hub owns', async () => {
    const { project } = setup();
    stubSkillsCli(async () => Buffer.from(''));

    await updateProjectSkills(project, noop);

    const { args } = vi.mocked(run).mock.calls[0][2]!;
    expect(args!.slice(args!.indexOf('--skill') + 1, args!.indexOf('--agent'))).toEqual([
      'skill-a',
      'skill-b',
    ]);
  });

  it('keeps one of those the creator installed themselves', async () => {
    const { project } = setupInstalledScene({ 'skill-a': 'h-a', 'deploy-scene': 'old' });
    stubSkillsCli(async () => Buffer.from(''));

    await updateProjectSkills(project, noop);

    const { args } = vi.mocked(run).mock.calls[0][2]!;
    expect(args).toContain('deploy-scene');
  });

  it("fails without touching the scene when the latest skills can't be read", async () => {
    const { cache, project } = setup();
    linkSkillsIntoProject(project, cache, noop);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(updateProjectSkills(project, noop)).rejects.toThrow('offline');
    expect(run).not.toHaveBeenCalled();
    expect(fs.lstatSync(path.join(project, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('stops a `skills add` that hangs, so the AI assistant is not held off forever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { project } = setup();
    const kill = stubSkillsCli(() => new Promise(() => {}));

    const update = updateProjectSkills(project, noop);
    const failed = expect(update).rejects.toThrow('was stopped');
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(3 * 60_000);

    await failed;
    expect(kill).toHaveBeenCalled();
  });

  it("removes Creator Hub's links before the CLI runs", async () => {
    const { project } = setup();
    const cacheSkills = path.join(userData, 'sdk-skills', 'skills');
    fs.mkdirSync(cacheSkills, { recursive: true });
    linkSkillsIntoProject(project, cacheSkills, noop);
    let linkedWhileRunning: boolean | undefined;
    stubSkillsCli(async () => {
      linkedWhileRunning = fs.existsSync(path.join(project, '.claude', 'skills'));
    });

    await updateProjectSkills(project, noop);

    expect(linkedWhileRunning).toBe(false);
  });

  it('rejects when the CLI exits with an error', async () => {
    const { project } = setup();
    stubSkillsCli(async () => {
      throw new Error('exited with code=1');
    });
    await expect(updateProjectSkills(project, noop)).rejects.toThrow('code=1');
  });

  it('joins an update already running in the same scene instead of starting another', async () => {
    const { project } = setup();
    let finish!: () => void;
    stubSkillsCli(() => new Promise<void>(resolve => (finish = resolve)));

    const first = updateProjectSkills(project, noop);
    const second = updateProjectSkills(project, noop);
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    finish();
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('holds off linking the AI assistant skills until the update is done', async () => {
    const { project } = setup();
    let finish!: () => void;
    stubSkillsCli(() => new Promise<void>(resolve => (finish = resolve)));

    const update = updateProjectSkills(project, noop);
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    let linked = false;
    const linking = ensureSkillsLinked(project).then(() => (linked = true));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(linked).toBe(false);
    expect(fs.existsSync(path.join(project, '.claude', 'skills'))).toBe(false);

    finish();
    await update;
    await linking;
    expect(fs.lstatSync(path.join(project, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });
});
