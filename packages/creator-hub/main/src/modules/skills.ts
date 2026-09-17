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
    const shaRes = await fetchWithTimeout(
      `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
      SHA_TIMEOUT_MS,
      'application/vnd.github.sha',
    );
    const sha = (await shaRes.text()).trim();
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
    fs.rmSync(skillsPath); // ours from a previous open — repoint in case the cache moved
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
      fs.rmSync(linkPath);
  }
  for (const name of cacheNames) {
    const linkPath = path.join(skillsPath, name);
    if (isSymlink(linkPath)) {
      if (!isOwnedLink(linkPath, cacheSkillsDir)) continue; // their symlink
      fs.rmSync(linkPath);
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
