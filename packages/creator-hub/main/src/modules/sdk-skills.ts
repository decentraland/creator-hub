import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import log from 'electron-log';

import { fetch } from '/shared/fetch';

import { getUserDataPath } from './electron';

const execFileAsync = promisify(execFile);

const REPO = 'decentraland/sdk-skills';
const BRANCH = 'main';
const USER_AGENT = 'decentraland-creator-hub';
const FETCH_TIMEOUT_MS = 30_000;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MARKER_FILE = '.dcl-sdk-skills.json';

type CacheMeta = {
  sha: string;
  fetchedAt: number;
};

type ProjectMarker = {
  sha: string;
  skills: string[];
};

function getCacheRoot(): string {
  return path.join(getUserDataPath(), 'sdk-skills');
}

function getMetaPath(cacheRoot: string): string {
  return path.join(cacheRoot, 'meta.json');
}

function getCacheSkillsDir(cacheRoot: string): string {
  return path.join(cacheRoot, 'skills');
}

function getProjectSkillsDir(projectPath: string): string {
  return path.join(projectPath, '.agents', 'skills');
}

function isSafeDirName(name: string): boolean {
  return !!name && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\');
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Lists the top-level directories of `dir` that contain a SKILL.md file.
 * Returns an empty array when `dir` does not exist.
 */
async function listSkillDirs(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.stat(path.join(dir, entry.name, 'SKILL.md'));
      skills.push(entry.name);
    } catch {
      // Not a skill directory.
    }
  }
  return skills.sort();
}

async function fetchLatestSha(): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' } },
      FETCH_TIMEOUT_MS,
    );
    if (!response.ok) {
      log.warn(`[SDK-Skills] GitHub API returned ${response.status} when checking latest commit`);
      return null;
    }
    const body: { sha?: string } = await response.json();
    return typeof body.sha === 'string' && body.sha ? body.sha : null;
  } catch (error) {
    log.warn('[SDK-Skills] Failed to check the latest sdk-skills commit:', error);
    return null;
  }
}

/**
 * Downloads the sdk-skills repo tarball at `sha`, extracts it, and atomically
 * replaces the cache's skills directory with the skill folders it contains.
 */
async function downloadSkillsToCache(cacheRoot: string, sha: string): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dcl-sdk-skills-'));
  try {
    const response = await fetch(
      `https://codeload.github.com/${REPO}/tar.gz/${sha}`,
      { headers: { 'User-Agent': USER_AGENT } },
      FETCH_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new Error(`Tarball download failed with status ${response.status}`);
    }
    const tarballPath = path.join(tmpDir, 'sdk-skills.tar.gz');
    await fs.writeFile(tarballPath, new Uint8Array(await response.arrayBuffer()));

    const extractDir = path.join(tmpDir, 'extracted');
    await fs.mkdir(extractDir);
    await execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDir]);

    // GitHub tarballs extract to a single root folder (codeload names it
    // `<repo>-<ref>`, e.g. `sdk-skills-<sha>`). Some tar versions also emit a
    // stray `pax_global_header` file, so match directories only.
    const extracted = await fs.readdir(extractDir, { withFileTypes: true });
    const directories = extracted.filter(entry => entry.isDirectory());
    const repoRootEntry =
      directories.length === 1
        ? directories[0]
        : directories.find(entry => entry.name.includes('sdk-skills'));
    if (!repoRootEntry) {
      throw new Error('Extracted tarball is missing the repository root folder');
    }
    const repoRoot = path.join(extractDir, repoRootEntry.name);

    const skillNames = await listSkillDirs(repoRoot);
    if (skillNames.length === 0) {
      throw new Error('Downloaded repository contains no skill directories');
    }

    // Stage the skill folders, then swap them in atomically so a concurrent
    // reader never sees a half-written cache.
    const stagingDir = path.join(cacheRoot, `skills.staging-${Date.now()}`);
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.mkdir(stagingDir, { recursive: true });
    for (const name of skillNames) {
      await fs.cp(path.join(repoRoot, name), path.join(stagingDir, name), { recursive: true });
    }

    const skillsDir = getCacheSkillsDir(cacheRoot);
    const oldDir = path.join(cacheRoot, `skills.old-${Date.now()}`);
    try {
      await fs.rename(skillsDir, oldDir);
    } catch {
      // No previous skills directory to move out of the way.
    }
    await fs.rename(stagingDir, skillsDir);
    await fs.rm(oldDir, { recursive: true, force: true });

    const meta: CacheMeta = { sha, fetchedAt: Date.now() };
    await writeJson(getMetaPath(cacheRoot), meta);
    log.info(`[SDK-Skills] Cached ${skillNames.length} skills at commit ${sha.slice(0, 7)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Makes sure the app-level skills cache exists and is reasonably fresh.
 * Network failures never throw: an existing cache is kept as-is, and with no
 * cache at all the function just logs and returns.
 */
async function ensureCache(cacheRoot: string): Promise<void> {
  const metaPath = getMetaPath(cacheRoot);
  const meta = await readJson<CacheMeta>(metaPath);
  const hasSkills = (await listSkillDirs(getCacheSkillsDir(cacheRoot))).length > 0;

  if (meta && hasSkills) {
    if (Date.now() - meta.fetchedAt < CACHE_MAX_AGE_MS) return;
    const latestSha = await fetchLatestSha();
    if (!latestSha) return; // Keep the existing cache silently.
    if (latestSha === meta.sha) {
      await writeJson(metaPath, { sha: meta.sha, fetchedAt: Date.now() } satisfies CacheMeta);
      return;
    }
    try {
      await downloadSkillsToCache(cacheRoot, latestSha);
    } catch (error) {
      log.warn('[SDK-Skills] Failed to refresh the skills cache, keeping the previous one:', error);
    }
    return;
  }

  // No usable cache yet: fetch now, blocking the agent start once.
  const latestSha = await fetchLatestSha();
  if (!latestSha) {
    log.warn('[SDK-Skills] No skills cache and GitHub is unreachable; skipping skills install');
    return;
  }
  try {
    await downloadSkillsToCache(cacheRoot, latestSha);
  } catch (error) {
    log.warn('[SDK-Skills] Failed to download the skills cache:', error);
  }
}

// Deduplicates concurrent cache refreshes (e.g. two projects starting agents
// at the same time).
let cacheRefreshPromise: Promise<void> | null = null;

function ensureCacheOnce(cacheRoot: string): Promise<void> {
  if (!cacheRefreshPromise) {
    cacheRefreshPromise = ensureCache(cacheRoot).finally(() => {
      cacheRefreshPromise = null;
    });
  }
  return cacheRefreshPromise;
}

/**
 * Syncs the cached skills into `<projectPath>/.agents/skills`. A marker file
 * records the cache sha and the skill directories we installed, so unchanged
 * projects are a no-op, stale skills we own get removed, and directories the
 * user added themselves are never touched.
 *
 * Returns true when the project ends up with skills installed.
 */
export async function syncProjectSkills(cacheRoot: string, projectPath: string): Promise<boolean> {
  const meta = await readJson<CacheMeta>(getMetaPath(cacheRoot));
  const cacheSkillsDir = getCacheSkillsDir(cacheRoot);
  const skillNames = await listSkillDirs(cacheSkillsDir);
  if (!meta || skillNames.length === 0) {
    log.warn('[SDK-Skills] Skills cache is empty; the agent will use its bundled skills');
    return false;
  }

  const projectSkillsDir = getProjectSkillsDir(projectPath);
  const markerPath = path.join(projectSkillsDir, MARKER_FILE);
  const marker = await readJson<ProjectMarker>(markerPath);
  if (marker?.sha === meta.sha) return true;

  await fs.mkdir(projectSkillsDir, { recursive: true });
  for (const name of skillNames) {
    const destination = path.join(projectSkillsDir, name);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(path.join(cacheSkillsDir, name), destination, { recursive: true });
  }

  // Remove skills we installed previously that no longer exist upstream.
  // Only names recorded in the marker are ever deleted, so user-added
  // directories are preserved.
  const previouslyOwned = marker?.skills ?? [];
  for (const name of previouslyOwned) {
    if (!skillNames.includes(name) && isSafeDirName(name)) {
      await fs.rm(path.join(projectSkillsDir, name), { recursive: true, force: true });
    }
  }

  await writeJson(markerPath, { sha: meta.sha, skills: skillNames } satisfies ProjectMarker);
  log.info(
    `[SDK-Skills] Installed ${skillNames.length} skills into ${projectSkillsDir} (commit ${meta.sha.slice(0, 7)})`,
  );
  return true;
}

/**
 * Makes sure the official Decentraland SDK skills are installed in the
 * project before the AI agent starts. Never throws: on any failure the agent
 * simply starts with whatever skills are already available.
 */
export async function ensureSdkSkills(projectPath: string): Promise<void> {
  try {
    const cacheRoot = getCacheRoot();
    await ensureCacheOnce(cacheRoot);
    await syncProjectSkills(cacheRoot, projectPath);
  } catch (error) {
    log.warn(`[SDK-Skills] Failed to ensure SDK skills for ${projectPath}:`, error);
  }
}
