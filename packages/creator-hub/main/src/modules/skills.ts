// Decentraland SDK skills (github.com/decentraland/sdk-skills) for the AI assistant.
// Downloaded at runtime into a userData cache (refreshed by commit SHA, offline-
// tolerant), then linked into the open scene as .claude/skills (Claude Code) and
// .agents/skills (Codex's native discovery path) so both provider CLIs pick them up
// from their cwd. Skill content is trusted first-party Decentraland guidance, and the
// assistant that reads it already runs with the shell and the network (see ai.ts), so
// this treats the download as a plain content sync rather than something to sandbox.
//
// Ported from the Bevy editor's skills.ts. The one behavioral difference is the
// denylist: Creator Hub is composite-first (the Inspector owns the scene graph), so the
// general `sdk-scenes` guidance is kept; only the app-owned flows (scaffolding, deploy,
// SDK6 migration) are dropped.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import log from 'electron-log/main';

import type { ProjectInfo } from '/shared/types/projects';
import type { SkillsUpdateStatus } from '/shared/types/skills';
import { FileSystemStorage } from '/shared/types/storage';

import { getWorkspaceConfigPath } from './electron';

const REPO = 'decentraland/sdk-skills';
const BRANCH = 'main';
const SHA_TIMEOUT_MS = 15_000;
const TARBALL_TIMEOUT_MS = 90_000; // ~4MB over hotel/mobile links; the SHA call stays snappy

// Skills the editor itself owns and the assistant must not run as CLI walkthroughs:
// scaffolding a new scene, deploying/publishing (Creator Hub's Publish flow does this),
// and SDK6→SDK7 migration (Creator Hub is SDK7-only). A denylist so new upstream skills
// default IN. Denylisted skills ship their supporting files but NOT SKILL.md: without
// frontmatter they can never trigger, yet other skills' ../<name>/references/ paths
// still resolve.
const SKILL_DENYLIST = new Set([
  'create-scene',
  'deploy-scene',
  'deploy-worlds',
  'migrate-sdk6-to-sdk7',
]);

type Logger = (msg: string) => void;
const defaultLog: Logger = msg => log.info(`[sdk-skills] ${msg}`);

// Extract with the system tar (bsdtar ships with macOS and Windows 10+) — Node has no
// built-in untar and this avoids a dependency.
function untar(archive: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', destDir, '--strip-components', '1'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', e => reject(new Error(`tar failed to spawn: ${e.message}`)));
    child.on('exit', code =>
      code === 0 ? resolve() : reject(new Error(`tar exited ${code}: ${stderr.trim()}`)),
    );
  });
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  accept?: string,
): Promise<Response> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: accept !== undefined ? { Accept: accept } : undefined,
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

async function fetchLatestSha(): Promise<string> {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
    SHA_TIMEOUT_MS,
    'application/vnd.github.sha',
  );
  return (await res.text()).trim();
}

// SHA the cache was built from, or null when there is nothing reusable (no tree,
// unreadable/foreign meta, or a meta written by another app version).
function readCachedSha(metaPath: string, skillsDir: string, appVersion: string): string | null {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      sha?: string;
      appVersion?: string;
    };
    return fs.existsSync(skillsDir) &&
      meta.appVersion === appVersion &&
      typeof meta.sha === 'string'
      ? meta.sha
      : null;
  } catch {
    return null;
  }
}

// Ensure the cache at <cacheDir>/skills holds the latest skills, one folder per skill
// (only tarball dirs with a SKILL.md, frontmatter-sanitized; denylisted skills keep
// supporting files but drop SKILL.md). Keyed on upstream SHA + appVersion so a new app
// version rebuilds even when upstream didn't move. Never throws: offline or a failed
// refresh keeps whatever cache exists. Returns the skills dir, or null when there's none.
export async function ensureSkillsCache(
  cacheDir: string,
  appVersion: string,
  logger: Logger = defaultLog,
): Promise<string | null> {
  const skillsDir = path.join(cacheDir, 'skills');
  const metaPath = path.join(cacheDir, 'meta.json');
  const stageNew = path.join(cacheDir, 'skills.new');
  const stageOld = path.join(cacheDir, 'skills.old');

  // Recover from a crash mid-swap: the last-good tree may be stranded in skills.old
  // (renamed out of skills before the new tree landed). Restore it before anything
  // else reads or deletes it.
  if (!fs.existsSync(skillsDir) && fs.existsSync(stageOld)) {
    try {
      fs.renameSync(stageOld, skillsDir);
    } catch {
      /* fall through — a later successful refresh will repopulate */
    }
  }

  const cached = readCachedSha(metaPath, skillsDir, appVersion);

  try {
    const sha = await fetchLatestSha();
    if (sha === cached) return skillsDir;

    const tarRes = await fetchWithTimeout(
      `https://codeload.github.com/${REPO}/tar.gz/${sha}`,
      TARBALL_TIMEOUT_MS,
    );
    const tarball = Buffer.from(await tarRes.arrayBuffer());
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-skills-'));
    try {
      const archive = path.join(work, 'repo.tar.gz');
      const extracted = path.join(work, 'repo');
      fs.writeFileSync(archive, tarball);
      fs.mkdirSync(extracted);
      await untar(archive, extracted);

      // Build the filtered tree directly at the swap staging dir (same volume as
      // skillsDir, so the rename below is atomic and can't EXDEV).
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.rmSync(stageNew, { recursive: true, force: true }); // stale from a prior crash
      fs.mkdirSync(stageNew);
      let count = 0;
      for (const entry of fs.readdirSync(extracted, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const src = path.join(extracted, entry.name);
        if (!fs.existsSync(path.join(src, 'SKILL.md'))) continue;
        const dest = path.join(stageNew, entry.name);
        if (SKILL_DENYLIST.has(entry.name)) {
          if (fs.readdirSync(src).every(n => n === 'SKILL.md')) continue; // nothing but the trigger
          fs.cpSync(src, dest, { recursive: true, filter: s => path.basename(s) !== 'SKILL.md' });
          continue;
        }
        fs.cpSync(src, dest, { recursive: true });
        count++;
      }
      if (count === 0) throw new Error('tarball contained no skills');

      // Swap via renames on the cache volume so there is never a window where skillsDir
      // is half-copied; meta.json is absent while the swap is in flight, so a crash
      // mid-swap reads as "no cache" and rebuilds. If the second rename fails (e.g.
      // Windows AV lock), restore the last-good tree instead of stranding the user.
      fs.rmSync(stageOld, { recursive: true, force: true });
      fs.rmSync(metaPath, { force: true });
      const hadOld = fs.existsSync(skillsDir);
      if (hadOld) fs.renameSync(skillsDir, stageOld);
      try {
        fs.renameSync(stageNew, skillsDir);
      } catch (e) {
        if (hadOld) fs.renameSync(stageOld, skillsDir);
        throw e;
      }
      fs.rmSync(stageOld, { recursive: true, force: true });
      fs.writeFileSync(
        metaPath,
        JSON.stringify({ sha, appVersion, updatedAt: new Date().toISOString() }),
      );
      logger(`updated to ${REPO}@${sha.slice(0, 7)} (${count} skills)`);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
    return skillsDir;
  } catch (e) {
    // Check the dir itself, not `cached` — a failed swap must not report a cache that's
    // no longer there (and a corrupt meta must not hide one that is).
    const usable = fs.existsSync(skillsDir);
    logger(
      `refresh failed (${String(e)}) — ${usable ? 'using cached copy' : 'no cache yet, skills unavailable'}`,
    );
    return usable ? skillsDir : null;
  }
}

// A directory symlink; junction on Windows (no admin/dev-mode needed there).
function linkDir(target: string, linkPath: string): void {
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

// Remove a link we made (a symlink, or a junction on Windows) without touching its target.
// Not fs.rmSync: on Windows, the Node that Electron 40 ships (24.11.1) refuses a junction with
// ERR_FS_EISDIR ("Path is a directory"), so every turn after the first failed to relink.
// unlinkSync removes a symlink or a junction on every platform and Node version.
function removeLink(p: string): void {
  fs.unlinkSync(p);
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// Only repoint symlinks WE created — recognized by their target resolving into the
// current cache dir. A user's own symlink (including one pointing at their own
// sdk-skills checkout) must never be destroyed, so ownership is an exact cache-path
// match, not a name heuristic.
function isOwnedLink(linkPath: string, cacheSkillsDir: string): boolean {
  let target: string;
  try {
    target = fs.readlinkSync(linkPath);
  } catch {
    return false;
  }
  const norm = path.normalize(target.replace(/^\\\\\?\\/, '')).replace(/[\\/]+$/, '');
  const cache = path.normalize(cacheSkillsDir).replace(/[\\/]+$/, '');
  return norm === cache || norm.startsWith(cache + path.sep);
}

// Make sure <dir>/.gitignore covers `entry` — appending to an existing file so the
// machine-local absolute symlink can never be committed.
function ensureGitignored(dir: string, entry: string): void {
  const gi = path.join(dir, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gi, 'utf8');
  } catch {
    /* new file */
  }
  const covered = content
    .split('\n')
    .some(l => [entry, `/${entry}`, `${entry}/`].includes(l.trim()));
  if (covered) return;
  const head = content === '' || content.endsWith('\n') ? content : `${content}\n`;
  fs.writeFileSync(gi, `${head}${entry}\n`);
}

// Link the cached skills into one agent dir of the project (.claude or .agents).
// Preferred shape: <project>/<dir>/skills is a single symlink to the cache. If the user
// already has a real skills dir of their own, link each skill individually and skip any
// name they already have — theirs win. Every app-created link is .gitignore-covered.
function linkAgentDir(
  projectDir: string,
  agentDir: string,
  cacheSkillsDir: string,
  logger: Logger,
): void {
  const dir = path.join(projectDir, agentDir);
  const skillsPath = path.join(dir, 'skills');

  if (isSymlink(skillsPath)) {
    if (!isOwnedLink(skillsPath, cacheSkillsDir)) {
      logger(`${agentDir}/skills is a user-made symlink — leaving it alone`);
      return;
    }
    removeLink(skillsPath); // ours from a previous open — repoint in case the cache moved
  }
  if (!fs.existsSync(skillsPath)) {
    fs.mkdirSync(dir, { recursive: true });
    ensureGitignored(dir, 'skills');
    linkDir(cacheSkillsDir, skillsPath);
    return;
  }

  // Merge into the user's own real skills dir. Ignore each name we inject (not the whole
  // dir — theirs stay tracked), and prune owned links whose skill is gone from the cache
  // (denylisted/removed upstream) so no dangling links linger.
  const cacheNames = new Set(fs.readdirSync(cacheSkillsDir));
  for (const name of fs.readdirSync(skillsPath)) {
    const linkPath = path.join(skillsPath, name);
    if (!cacheNames.has(name) && isSymlink(linkPath) && isOwnedLink(linkPath, cacheSkillsDir))
      removeLink(linkPath);
  }
  for (const name of cacheNames) {
    const linkPath = path.join(skillsPath, name);
    if (isSymlink(linkPath)) {
      if (!isOwnedLink(linkPath, cacheSkillsDir)) continue; // their symlink
      removeLink(linkPath);
    } else if (fs.existsSync(linkPath)) {
      continue; // their own skill of the same name
    }
    linkDir(path.join(cacheSkillsDir, name), linkPath);
    ensureGitignored(skillsPath, name);
  }
}

// Best-effort: a scene without skills still works, the assistant just loses the SDK7
// guidance for that session.
export function linkSkillsIntoProject(
  projectDir: string,
  cacheSkillsDir: string,
  logger: Logger = defaultLog,
): void {
  for (const agentDir of ['.claude', '.agents']) {
    try {
      linkAgentDir(projectDir, agentDir, cacheSkillsDir, logger);
    } catch (e) {
      logger(`could not link skills into ${agentDir}: ${String(e)}`);
    }
  }
}

// ---- Orchestration ----

// One shared cache refresh per app run. Warmed at startup and reused by every turn.
let cachePromise: Promise<string | null> | null = null;

export function warmSkillsCache(): Promise<string | null> {
  cachePromise ??= ensureSkillsCache(
    path.join(app.getPath('userData'), 'sdk-skills'),
    app.getVersion(),
  );
  return cachePromise;
}

// Ensure the cache is present and linked into the project. Awaited before a turn so the
// CLI finds the skills in its cwd; degrades to a no-op when the cache is unavailable.
export async function ensureSkillsLinked(projectDir: string): Promise<void> {
  const dir = await warmSkillsCache();
  if (dir !== null) linkSkillsIntoProject(projectDir, dir);
}

// ---- Skills the creator installed into the scene themselves ----
//
// Separate from the cache above: a creator who ran `npx skills add decentraland/sdk-skills`
// in their scene (for their own Claude Code, Cursor, ...) gets a project-local copy that
// never refreshes on its own. Creator Hub remembers which upstream commit that copy came
// from (`ProjectInfo.sdkSkills`) and offers an update once main has moved past it.

const SKILLS_LOCK = 'skills-lock.json';
// `add`, not `update`: `update` only refreshes skills already in the lock, so a skill added
// upstream since (e.g. bug reporting) would never arrive. `--yes` is npx's own install
// prompt, which would otherwise hang a child with no TTY; `--all` skips the CLI's prompts.
const SKILLS_ADD_ARGS = ['--yes', 'skills', 'add', REPO, '--all'];

type SkillsLock = { skills?: Record<string, { source?: string }> };

function getCacheSkillsDir(): string {
  return path.join(app.getPath('userData'), 'sdk-skills', 'skills');
}

async function getProjectInfoStorage(projectDir: string) {
  const projectInfoPath = path.join(await getWorkspaceConfigPath(projectDir), 'project.json');
  return FileSystemStorage.getOrCreate<ProjectInfo>(projectInfoPath);
}

// mtime of the scene's skills lock when it lists decentraland/sdk-skills, else null.
export function getSdkSkillsLockTime(projectDir: string): number | null {
  const lockPath = path.join(projectDir, SKILLS_LOCK);
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as SkillsLock;
    const fromRepo = Object.values(lock.skills ?? {}).some(s =>
      (s.source ?? '').toLowerCase().includes(REPO),
    );
    return fromRepo ? fs.statSync(lockPath).mtimeMs : null;
  } catch {
    return null;
  }
}

async function hasCommitsSince(since: number): Promise<boolean> {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&since=${new Date(since).toISOString()}&per_page=1`,
    SHA_TIMEOUT_MS,
  );
  const commits = (await res.json()) as unknown[];
  return commits.length > 0;
}

// Whether the scene's own copy of the skills is behind upstream main. Never throws: offline
// or a GitHub error reads as "up to date" so the check can't block opening a scene.
export async function getProjectSkillsStatus(
  projectDir: string,
  logger: Logger = defaultLog,
): Promise<SkillsUpdateStatus> {
  const lockTime = getSdkSkillsLockTime(projectDir);
  if (lockTime === null) return { installed: false, outdated: false };

  try {
    const storage = await getProjectInfoStorage(projectDir);
    const recorded = await storage.get('sdkSkills');
    const latestSha = await fetchLatestSha();

    // A lock rewritten after our record means the creator ran `skills add` on their own, so
    // the recorded commit no longer describes what they have.
    if (recorded && recorded.recordedAt >= lockTime) {
      return { installed: true, outdated: recorded.sha !== latestSha };
    }

    // No usable record (installed outside Creator Hub): judge by when the lock was written.
    // If nothing landed on main since, what they have IS the latest commit, so record it
    // and compare by SHA from now on.
    const outdated = await hasCommitsSince(lockTime);
    if (!outdated) await storage.set('sdkSkills', { sha: latestSha, recordedAt: Date.now() });
    return { installed: true, outdated };
  } catch (e) {
    logger(`could not check ${projectDir} for a skills update: ${String(e)}`);
    return { installed: true, outdated: false };
  }
}

// Remove the links Creator Hub made into the scene (see linkSkillsIntoProject) so the CLI
// writes a real folder instead of writing through a link into the shared cache. The next AI
// turn links back whatever the creator doesn't have, in merge mode.
export function unlinkSkillsFromProject(projectDir: string, cacheSkillsDir: string): void {
  for (const agentDir of ['.claude', '.agents']) {
    const skillsPath = path.join(projectDir, agentDir, 'skills');
    if (isSymlink(skillsPath)) {
      if (isOwnedLink(skillsPath, cacheSkillsDir)) removeLink(skillsPath);
      continue;
    }
    if (!fs.existsSync(skillsPath)) continue;
    for (const name of fs.readdirSync(skillsPath)) {
      const linkPath = path.join(skillsPath, name);
      if (isSymlink(linkPath) && isOwnedLink(linkPath, cacheSkillsDir)) removeLink(linkPath);
    }
  }
}

export async function updateProjectSkills(
  projectDir: string,
  logger: Logger = defaultLog,
): Promise<void> {
  unlinkSkillsFromProject(projectDir, getCacheSkillsDir());

  // Read before running so the record can't claim a commit that landed mid-install.
  let sha: string | null = null;
  try {
    sha = await fetchLatestSha();
  } catch (e) {
    logger(`could not read the latest ${REPO} commit: ${String(e)}`);
  }

  // Loaded here, not at the top: ai.ts imports this module, and bin.ts resolves Electron app
  // paths on import, which would break every main test that reaches ai.ts.
  const { run } = await import('./bin');
  const child = run('npm', 'npx', { args: SKILLS_ADD_ARGS, cwd: projectDir });
  await child.wait();
  logger(`updated the skills in ${projectDir}${sha ? ` to ${sha.slice(0, 7)}` : ''}`);

  if (sha !== null) {
    const storage = await getProjectInfoStorage(projectDir);
    await storage.set('sdkSkills', { sha, recordedAt: Date.now() });
  }
}
