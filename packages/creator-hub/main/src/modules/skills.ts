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
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import log from 'electron-log/main';

import type { SkillsUpdateStatus } from '/shared/types/skills';

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
  if (!res.ok) {
    // An unread body holds the connection open; unauthenticated 403s are routine here.
    await res.body?.cancel();
    throw new Error(`${url} → HTTP ${res.status}`);
  }
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

// Per upstream skill folder, every `computedHash` a `skills add` of that commit can write.
type SkillHashes = Record<string, string[]>;
type CacheMeta = { sha?: string; appVersion?: string; hashes?: SkillHashes };

function readCacheMeta(metaPath: string): CacheMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as CacheMeta;
  } catch {
    return null;
  }
}

// SHA the cache was built from, or null when there is nothing reusable (no tree,
// unreadable/foreign meta, a meta written by another app version, or one from before
// skill hashes were recorded).
function readCachedSha(metaPath: string, skillsDir: string, appVersion: string): string | null {
  const meta = readCacheMeta(metaPath);
  return meta &&
    fs.existsSync(skillsDir) &&
    meta.appVersion === appVersion &&
    typeof meta.sha === 'string' &&
    meta.hashes !== undefined
    ? meta.sha
    : null;
}

function collectFiles(baseDir: string, dir: string, out: { rel: string; content: Buffer }[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== 'node_modules') collectFiles(baseDir, full, out);
    } else if (entry.isFile()) {
      out.push({
        rel: path.relative(baseDir, full).split(path.sep).join('/'),
        content: fs.readFileSync(full),
      });
    }
  }
}

// The `skills` CLI's computedHash (its computeSkillFolderHash, skills@1.7.4): SHA-256 over
// each file's folder-relative path then bytes, in localeCompare order.
function hashSkillFolder(dir: string, transform: (rel: string, content: Buffer) => Buffer) {
  const files: { rel: string; content: Buffer }[] = [];
  collectFiles(dir, dir, files);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file.rel);
    hash.update(transform(file.rel, file.content));
  }
  return hash.digest('hex');
}

// A .gitattributes pattern as a RegExp over repo-relative paths: `*` and `?` stay within one
// folder, `**` crosses folders, and a pattern without a `/` matches the file name at any depth.
function gitattributesPattern(pattern: string): RegExp {
  const glob = pattern.replace(/^\//, '');
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(pattern.includes('/') ? `^${re}$` : `(^|/)${re}$`);
}

// Which repo paths .gitattributes keeps byte-exact on checkout (`-text`, `binary`, `-crlf`,
// or forced to LF with `eol=lf`).
function readUnconvertedPaths(repoDir: string): (relPath: string) => boolean {
  let content = '';
  try {
    content = fs.readFileSync(path.join(repoDir, '.gitattributes'), 'utf8');
  } catch {
    /* none */
  }
  const patterns: RegExp[] = [];
  for (const line of content.split('\n')) {
    const [pattern, ...attrs] = line.trim().split(/\s+/);
    if (!pattern || pattern.startsWith('#')) continue;
    if (attrs.some(a => ['-text', 'binary', '-crlf', 'eol=lf'].includes(a)))
      patterns.push(gitattributesPattern(pattern));
  }
  return relPath => patterns.some(p => p.test(relPath));
}

// The CLI hashes a `git clone`, so under core.autocrlf=true (Git for Windows' default) it
// hashes CRLF text files, and the lock holds that hash instead of the tarball's. Git leaves a
// file alone when it looks binary (a NUL byte) or already has a CR in it.
function hashSkillVariants(
  repoDir: string,
  name: string,
  isUnconverted: (relPath: string) => boolean,
): string[] {
  const lf = hashSkillFolder(path.join(repoDir, name), (_, content) => content);
  const crlf = hashSkillFolder(path.join(repoDir, name), (rel, content) =>
    isUnconverted(`${name}/${rel}`) || content.includes(0) || content.includes(13)
      ? content
      : Buffer.from(content.toString('latin1').replace(/\n/g, '\r\n'), 'latin1'),
  );
  return lf === crlf ? [lf] : [lf, crlf];
}

// Ensure the cache at <cacheDir>/skills holds the latest skills, one folder per skill
// (only tarball dirs with a SKILL.md, frontmatter-sanitized; denylisted skills keep
// supporting files but drop SKILL.md). Keyed on upstream SHA + appVersion so a new app
// version rebuilds even when upstream didn't move. Never throws: offline or a failed
// refresh keeps whatever cache exists. Returns the skills dir, or null when there's none.
// `knownSha` is upstream main's SHA when the caller already fetched it.
export async function ensureSkillsCache(
  cacheDir: string,
  appVersion: string,
  logger: Logger = defaultLog,
  knownSha?: string,
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
    const sha = knownSha ?? (await fetchLatestSha());
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
      const hashes: SkillHashes = {};
      const isUnconverted = readUnconvertedPaths(extracted);
      for (const entry of fs.readdirSync(extracted, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const src = path.join(extracted, entry.name);
        if (!fs.existsSync(path.join(src, 'SKILL.md'))) continue;
        hashes[entry.name] = hashSkillVariants(extracted, entry.name, isUnconverted);
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
        JSON.stringify({ sha, appVersion, hashes, updatedAt: new Date().toISOString() }),
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

// Undo ensureGitignored: drop the `entry` line Creator Hub added to <dir>/.gitignore, and the
// file too when nothing else is left in it.
function removeGitignored(dir: string, entry: string): void {
  const gi = path.join(dir, '.gitignore');
  let content: string;
  try {
    content = fs.readFileSync(gi, 'utf8');
  } catch {
    return;
  }
  const lines = content.split('\n');
  const kept = lines.filter(l => l.trim() !== entry);
  if (kept.length === lines.length) return;
  if (kept.every(l => l.trim() === '')) fs.rmSync(gi, { force: true });
  else fs.writeFileSync(gi, kept.join('\n'));
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

function getCacheDir(): string {
  return path.join(app.getPath('userData'), 'sdk-skills');
}

// One refresh at a time: concurrent ones would build into the same staging dirs.
let refreshing: Promise<string | null> | null = null;
function refreshSkillsCache(knownSha?: string): Promise<string | null> {
  refreshing ??= ensureSkillsCache(getCacheDir(), app.getVersion(), defaultLog, knownSha).finally(
    () => {
      refreshing = null;
    },
  );
  return refreshing;
}

// One shared cache refresh per app run, reused by every turn. A run that found no cache (e.g.
// started offline) is not kept, so a later turn tries again.
let cachePromise: Promise<string | null> | null = null;

export function warmSkillsCache(): Promise<string | null> {
  cachePromise ??= refreshSkillsCache().then(dir => {
    if (dir === null) cachePromise = null;
    return dir;
  });
  return cachePromise;
}

// `skills add` runs in flight, by resolved scene path.
const projectUpdates = new Map<string, Promise<void>>();

// Ensure the cache is present and linked into the project. Awaited before a turn so the
// CLI finds the skills in its cwd; degrades to a no-op when the cache is unavailable.
export async function ensureSkillsLinked(projectDir: string): Promise<void> {
  const dir = await warmSkillsCache();
  // A `skills add` running in this scene would write through our links into the shared
  // cache, so link only once it is done.
  let update: Promise<void> | undefined;
  while ((update = projectUpdates.get(path.resolve(projectDir)))) {
    await update.catch(() => {});
  }
  if (dir !== null) linkSkillsIntoProject(projectDir, dir);
}

// ---- Skills the creator installed into the scene themselves ----
//
// Separate from the cache above: a creator who ran `npx skills add decentraland/sdk-skills`
// in their scene (for their own Claude Code, Cursor, ...) gets a project-local copy that
// never refreshes on its own. The CLI records a content hash per skill in skills-lock.json;
// that copy is outdated once a skill it should have (see wantedSkills) is missing from the
// lock or hashes differently, or its folders are gone.

const SKILLS_LOCK = 'skills-lock.json';
// Pinned: the update runs on scene open under Auto-update, and the outdated check depends on
// how this version hashes a skill folder (see hashSkillFolder). Bump it on purpose.
const SKILLS_CLI = 'skills@1.7.4';
// A stuck `npx` would otherwise hold off the AI assistant in this scene (ensureSkillsLinked).
const SKILLS_ADD_TIMEOUT_MS = 3 * 60_000;

// `add`, not `update`: `update` only refreshes skills already in the lock, so a skill added
// upstream since (e.g. bug reporting) would never arrive. `--yes` is npx's own install
// prompt, which would otherwise hang a child with no TTY; `-y` skips the CLI's prompts.
// Not `--all`: its `--agent '*'` writes a skills folder for every agent the CLI knows.
// `claude-code` fills .claude/skills, and `codex` the shared .agents/skills that Codex,
// Cursor, Copilot, Gemini CLI and the other "universal" agents read.
function skillsAddArgs(skills: string[]): string[] {
  return [
    '--yes',
    SKILLS_CLI,
    'add',
    REPO,
    '--skill',
    ...skills,
    '--agent',
    'claude-code',
    'codex',
    '-y',
  ];
}

type SkillsLock = {
  skills?: Record<string, { source?: string; skillPath?: string; computedHash?: string }>;
};

// The scene's skills from decentraland/sdk-skills, by folder, with the hash the lock recorded.
// Null when the lock lists none. Keyed by folder, not lock name: the lock names a skill after
// its frontmatter.
function readSdkSkillsLock(projectDir: string): Map<string, string | undefined> | null {
  try {
    const lock = JSON.parse(
      fs.readFileSync(path.join(projectDir, SKILLS_LOCK), 'utf8'),
    ) as SkillsLock;
    const entries = Object.values(lock.skills ?? {}).filter(s =>
      (s.source ?? '').toLowerCase().includes(REPO),
    );
    if (entries.length === 0) return null;
    return new Map(entries.map(e => [path.posix.dirname(e.skillPath ?? ''), e.computedHash]));
  } catch {
    return null;
  }
}

// The skills a scene should have: every upstream skill except those whose flow Creator Hub
// owns (SKILL_DENYLIST), which an installed copy would show to the built-in assistant. One of
// those stays only when the creator installed it themselves.
function wantedSkills(upstream: SkillHashes, installed: Map<string, unknown>): string[] {
  return Object.keys(upstream).filter(name => !SKILL_DENYLIST.has(name) || installed.has(name));
}

// Whether any of these skills is in the scene as its own copy, not as one of our links into
// the cache. A clone of a scene whose skills folders were never committed has only the lock.
function hasOwnSkillFiles(projectDir: string, names: string[], cacheSkillsDir: string): boolean {
  const isOurs = (p: string) => isSymlink(p) && isOwnedLink(p, cacheSkillsDir);
  return ['.claude', '.agents'].some(agentDir => {
    const skillsPath = path.join(projectDir, agentDir, 'skills');
    if (isOurs(skillsPath)) return false;
    return names.some(name => {
      const skillPath = path.join(skillsPath, name);
      return !isOurs(skillPath) && fs.existsSync(path.join(skillPath, 'SKILL.md'));
    });
  });
}

// Hashes of upstream main's skills, refreshing the cache first so a scene updated since the
// app started isn't compared against an older commit. Null when they can't be had now.
async function getUpstreamSkillHashes(): Promise<SkillHashes | null> {
  const latestSha = await fetchLatestSha();
  await refreshSkillsCache(latestSha);
  const meta = readCacheMeta(path.join(getCacheDir(), 'meta.json'));
  return meta?.sha === latestSha && meta.hashes ? meta.hashes : null;
}

// Scenes updated during this app run. One still outdated right after an update (a future CLI
// that hashes differently, say) isn't offered or auto-updated again until the app restarts.
const updatedThisRun = new Set<string>();

// Whether the scene has its own copy of the skills and whether it is behind upstream main.
// Never throws: offline or a GitHub error reads as "up to date" so the check can't block
// opening a scene.
export async function getProjectSkillsStatus(
  projectDir: string,
  logger: Logger = defaultLog,
): Promise<SkillsUpdateStatus> {
  const installed = readSdkSkillsLock(projectDir);
  if (installed === null) return { installed: false, outdated: false };

  try {
    const upstream = await getUpstreamSkillHashes();
    if (upstream === null) {
      logger(`could not read the latest skills to check ${projectDir}`);
      return { installed: true, outdated: false };
    }
    const cacheSkillsDir = path.join(getCacheDir(), 'skills');
    const outdated =
      !hasOwnSkillFiles(projectDir, [...installed.keys()], cacheSkillsDir) ||
      wantedSkills(upstream, installed).some(
        name => !upstream[name].includes(installed.get(name) ?? ''),
      );
    if (outdated && updatedThisRun.has(path.resolve(projectDir))) {
      logger(`${projectDir} still differs from upstream after its update; not offering another`);
      return { installed: true, outdated: false };
    }
    return { installed: true, outdated };
  } catch (e) {
    logger(`could not check ${projectDir} for a skills update: ${String(e)}`);
    return { installed: true, outdated: false };
  }
}

// Remove the links Creator Hub made into the scene (see linkSkillsIntoProject), and their
// .gitignore lines, so the CLI writes real folders the creator can commit instead of writing
// through a link into the shared cache. The next AI turn links back whatever the creator
// doesn't have, in merge mode.
export function unlinkSkillsFromProject(projectDir: string, cacheSkillsDir: string): void {
  for (const agentDir of ['.claude', '.agents']) {
    const skillsPath = path.join(projectDir, agentDir, 'skills');
    if (isSymlink(skillsPath)) {
      if (isOwnedLink(skillsPath, cacheSkillsDir)) {
        removeLink(skillsPath);
        removeGitignored(path.join(projectDir, agentDir), 'skills');
      }
      continue;
    }
    if (!fs.existsSync(skillsPath)) continue;
    for (const name of fs.readdirSync(skillsPath)) {
      const linkPath = path.join(skillsPath, name);
      if (isSymlink(linkPath) && isOwnedLink(linkPath, cacheSkillsDir)) {
        removeLink(linkPath);
        removeGitignored(skillsPath, name);
      }
    }
  }
}

async function addSkillsToProject(projectDir: string, logger: Logger): Promise<void> {
  const upstream = await getUpstreamSkillHashes();
  if (upstream === null) throw new Error(`could not read the latest skills from ${REPO}`);
  const skills = wantedSkills(upstream, readSdkSkillsLock(projectDir) ?? new Map());
  if (skills.length === 0) throw new Error(`${REPO} lists no skills to install`);

  unlinkSkillsFromProject(projectDir, path.join(getCacheDir(), 'skills'));
  // Loaded here, not at the top: ai.ts imports this module, and bin.ts resolves Electron app
  // paths on import, which would break every main test that reaches ai.ts.
  const { run } = await import('./bin');
  const child = run('npm', 'npx', {
    args: skillsAddArgs(skills),
    cwd: projectDir,
    env: { DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1' }, // the CLI's install telemetry
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void child.kill();
      reject(new Error(`skills add took over ${SKILLS_ADD_TIMEOUT_MS / 1000}s and was stopped`));
    }, SKILLS_ADD_TIMEOUT_MS);
  });
  try {
    await Promise.race([child.wait(), timeout]);
  } finally {
    clearTimeout(timer);
  }
  updatedThisRun.add(path.resolve(projectDir));
  logger(`installed the latest skills in ${projectDir}`);
}

// Updates the scene's own copy of the skills. A second call for the same scene while one runs
// joins it instead of running `skills add` in the same folder twice.
export function updateProjectSkills(projectDir: string, logger: Logger = defaultLog) {
  const key = path.resolve(projectDir);
  let update = projectUpdates.get(key);
  if (update === undefined) {
    update = addSkillsToProject(projectDir, logger).finally(() => projectUpdates.delete(key));
    projectUpdates.set(key, update);
  }
  return update;
}
