import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { linkSkillsIntoProject } from '../src/modules/skills';

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
