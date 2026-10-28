// Let an AI agent running OUTSIDE the Hub — Claude Code in a terminal or VS Code, Codex,
// Claude Desktop — find and use the scene MCP server (scene-mcp.ts), with no human copying a
// URL + token out of Settings. Opt-in: nothing is exposed until the creator turns on
// "Allow AI agents outside Creator Hub", or an agent asks for it (see below). While it is on:
//
//   • `<userData>/mcp-server.json` — url + token for any agent, started anywhere.
//   • `<scene>/.mcp.json` — Claude Code's project-scope config, written into the scene open in
//     the editor (and removed when it closes), so a client started in that folder finds it.
//
// An agent can ask for access itself by creating `<userData>/mcp-server.request`. The Hub
// turns the setting on, writes `mcp-server.json`, and tells the creator in a notice that offers
// to turn it off again: no click is needed to grant it, and nothing is hidden either.
//
// Turning access off revokes it: the external token is dropped (live outside sessions close)
// and every file written this run is withdrawn. The in-app assistant has its own token and is
// unaffected either way. Both files are 0600, and a scene's `.mcp.json` is never written when
// the scene's repo tracks it, so the token can't end up in a commit.
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { app } from 'electron';
import log from 'electron-log/main';

import { AI_EXTERNAL_ACCESS_CHANGED } from '/shared/types/ipc';
import { MAIN_WINDOW_ID } from '../mainWindow';
import { getConfig, writeConfig } from './config';
import { getUserDataPath } from './electron';
import { ensureGitignored, removeMcpServer, upsertMcpServer } from './project-config-files';
import {
  getExternalMcpInfo,
  type SceneMcpInfo,
  setExternalMcpAccess,
  setSceneMcpProject,
} from './scene-mcp';
import { getWindow } from './window';

export const MCP_SERVER_NAME = 'creator-hub';
export const CLAUDE_MCP_CONFIG_FILE = '.mcp.json';
export const MCP_DISCOVERY_FILE = 'mcp-server.json';
export const MCP_ACCESS_REQUEST_FILE = 'mcp-server.request';

export interface McpDiscoveryInfo extends SceneMcpInfo {
  pid: number;
  startedAt: string;
  version: string;
}

// Claude Code reads `<project>/.mcp.json` (project scope) on session start. The port in `url`
// changes every launch, so the entry can't be static: write it 0600 and gitignore it first,
// so there is no window where a secret-bearing file is tracked. Scene templates' `.dclignore`
// ignores `.*`, so the file never ships with a deployed scene either.
export function writeClaudeMcpConfig(projectDir: string, mcp: SceneMcpInfo): void {
  ensureGitignored(projectDir, CLAUDE_MCP_CONFIG_FILE, {
    comment: 'Creator Hub — holds a local MCP token, do not commit',
  });
  upsertMcpServer(
    path.join(projectDir, CLAUDE_MCP_CONFIG_FILE),
    MCP_SERVER_NAME,
    { type: 'http', url: mcp.url, headers: { Authorization: `Bearer ${mcp.token}` } },
    { mode: 0o600 },
  );
}

export function removeClaudeMcpConfig(projectDir: string): void {
  removeMcpServer(path.join(projectDir, CLAUDE_MCP_CONFIG_FILE), MCP_SERVER_NAME);
}

// A `.gitignore` rule doesn't untrack a file the repo already has, and Claude Code intends
// `.mcp.json` to be committed and shared. If the scene's repo tracks it, writing our entry
// would put a token in the next commit, so leave such a scene alone. No git, or not a repo:
// nothing can be tracked.
export function isTrackedByGit(projectDir: string, file: string): Promise<boolean> {
  return new Promise(resolve => {
    execFile(
      'git',
      ['ls-files', '--error-unmatch', '--', file],
      { cwd: projectDir, timeout: 5_000, windowsHide: true },
      error => resolve(error === null),
    );
  });
}

export function discoveryFilePath(userDataDir: string = getUserDataPath()): string {
  return path.join(userDataDir, MCP_DISCOVERY_FILE);
}

export function accessRequestFilePath(userDataDir: string = getUserDataPath()): string {
  return path.join(userDataDir, MCP_ACCESS_REQUEST_FILE);
}

// `pid` lets a reader tell a live file from one a crashed Hub left behind; `startedAt` and
// `version` are there for the same diagnosis. A stale file is simply overwritten on the next
// grant, so a crash never needs manual cleanup.
export function writeMcpDiscoveryFile(file: string, info: McpDiscoveryInfo): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write-then-rename so a reader never sees a half-written file; the temp file carries the
  // 0600 mode across the rename.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(info, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function removeMcpDiscoveryFile(file: string): void {
  fs.rmSync(file, { force: true });
}

// --- Orchestration -----------------------------------------------------------------------

// The scene open in the editor window, reported by the renderer (ai.sceneOpened/sceneClosed).
let openProjectDir: string | null = null;
// Every scene that got a `.mcp.json` entry this run, so turning access off (or quitting)
// withdraws all of them, not only the one open right now.
const scenesWithConfig = new Set<string>();
// When access was last granted, for the discovery file's `startedAt`.
let grantedAt: string | null = null;
// An agent's request was granted and the renderer hasn't shown the notice yet. Pulled rather
// than only pushed, so a request honoured before the window loaded still gets its notice.
let pendingGrantNotice = false;

async function exposeEnabled(): Promise<boolean> {
  try {
    return (await getConfig()).settings.exposeMcpServer === true;
  } catch (e) {
    log.warn('[MCP] could not read settings, not exposing the server:', e);
    return false;
  }
}

async function externalInfo(): Promise<SceneMcpInfo | null> {
  try {
    return await getExternalMcpInfo();
  } catch (e) {
    log.warn('[MCP] server unavailable, nothing to publish for outside agents:', e);
    return null;
  }
}

async function publishProjectFile(projectDir: string, mcp: SceneMcpInfo): Promise<void> {
  if (await isTrackedByGit(projectDir, CLAUDE_MCP_CONFIG_FILE)) {
    log.info(`[MCP] ${CLAUDE_MCP_CONFIG_FILE} is tracked by git in ${projectDir}; not writing it`);
    return;
  }
  // The scene may have closed while git answered.
  if (openProjectDir !== projectDir) return;
  try {
    writeClaudeMcpConfig(projectDir, mcp);
    scenesWithConfig.add(projectDir);
  } catch (e) {
    log.warn(`[MCP] could not write ${CLAUDE_MCP_CONFIG_FILE} into ${projectDir}:`, e);
  }
}

function withdrawProjectFile(projectDir: string): void {
  try {
    removeClaudeMcpConfig(projectDir);
  } catch (e) {
    log.warn(`[MCP] could not remove ${CLAUDE_MCP_CONFIG_FILE} from ${projectDir}:`, e);
  }
  scenesWithConfig.delete(projectDir);
}

// Grant outside access and write both files for the running server (starting it if needed).
// Best-effort: a write failure degrades to "copy it from Settings", never a hard stop.
async function publish(): Promise<void> {
  setExternalMcpAccess(true);
  const mcp = await externalInfo();
  if (mcp === null) return;
  grantedAt ??= new Date().toISOString();
  try {
    writeMcpDiscoveryFile(discoveryFilePath(), {
      ...mcp,
      pid: process.pid,
      startedAt: grantedAt,
      version: app.getVersion(),
    });
  } catch (e) {
    log.warn('[MCP] could not write the discovery file:', e);
  }
  if (openProjectDir !== null) await publishProjectFile(openProjectDir, mcp);
  notifyAccessChanged();
}

// Revoke outside access and withdraw every file written for it this run.
function withdraw(): void {
  setExternalMcpAccess(false);
  grantedAt = null;
  pendingGrantNotice = false;
  clearMcpDiscovery();
  notifyAccessChanged();
}

// Settings may have flipped its switch before the write reached us, and an agent's request
// flips it with no click at all, so the renderer refetches on this rather than guessing.
function notifyAccessChanged(): void {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.webContents.send(AI_EXTERNAL_ACCESS_CHANGED);
}

// Called once at app start: expose the server if the creator left access on, then start
// listening for agents that ask for it.
export async function initMcpDiscovery(): Promise<void> {
  if (await exposeEnabled()) await publish();
  watchAccessRequests();
}

// A scene was opened in the editor. The server is pointed at it right away so an outside
// agent's tools work before any in-app turn ran, and its `.mcp.json` is written while access
// is on. With access off, an entry a crashed run left behind is cleaned up instead.
export async function sceneOpened(projectDir: string): Promise<void> {
  openProjectDir = projectDir;
  setSceneMcpProject(projectDir);
  if (!(await exposeEnabled())) {
    withdrawProjectFile(projectDir);
    return;
  }
  const mcp = await externalInfo();
  if (mcp !== null) await publishProjectFile(projectDir, mcp);
}

// The editor left the scene. Detach the server, so outside tools answer "No scene is open."
// instead of acting on a closed scene, and withdraw the scene's `.mcp.json`, so no client
// keeps retrying a dead port with a dead token.
export function sceneClosed(projectDir: string): void {
  if (openProjectDir !== projectDir) return;
  openProjectDir = null;
  setSceneMcpProject(null);
  withdrawProjectFile(projectDir);
}

// The `exposeMcpServer` setting changed from Settings.
export async function syncExposeMcpServer(enabled: boolean): Promise<void> {
  if (enabled) await publish();
  else withdraw();
}

// Withdraw everything on disk that advertises the server — on quit, and when access goes off.
// Synchronous so it completes inside the quit path.
export function clearMcpDiscovery(): void {
  try {
    removeMcpDiscoveryFile(discoveryFilePath());
  } catch (e) {
    log.warn('[MCP] could not remove the discovery file:', e);
  }
  for (const projectDir of [...scenesWithConfig]) withdrawProjectFile(projectDir);
}

// --- Access requested by an agent --------------------------------------------------------

// An agent created `<userData>/mcp-server.request`: grant access (or refresh the discovery
// file if it was already on), then let the creator know. The request file is consumed either
// way, so one request is honoured once.
async function handleAccessRequest(): Promise<void> {
  const file = accessRequestFilePath();
  if (!fs.existsSync(file)) return;
  fs.rmSync(file, { force: true });
  if (await exposeEnabled()) {
    await publish();
    return;
  }
  log.info('[MCP] an AI agent asked for outside access; turning it on');
  try {
    const config = await getConfig();
    await writeConfig({ ...config, settings: { ...config.settings, exposeMcpServer: true } });
  } catch (e) {
    log.warn('[MCP] could not save the setting; not granting access:', e);
    return;
  }
  pendingGrantNotice = true;
  await publish();
}

// fs.watch fires several events per create; chaining keeps one request from being handled
// twice (the second pass finds the file gone).
let requestChain: Promise<void> = Promise.resolve();
function queueAccessRequest(): void {
  requestChain = requestChain.then(handleAccessRequest).catch(e => {
    log.warn('[MCP] could not handle an access request:', e);
  });
}

let requestWatcher: fs.FSWatcher | null = null;
function watchAccessRequests(): void {
  queueAccessRequest(); // a request made while the Hub was closed
  try {
    requestWatcher = fs.watch(getUserDataPath(), (_event, name) => {
      if (name === MCP_ACCESS_REQUEST_FILE) queueAccessRequest();
    });
  } catch (e) {
    log.warn('[MCP] cannot watch for agent access requests:', e);
  }
}

export function stopWatchingAccessRequests(): void {
  requestWatcher?.close();
  requestWatcher = null;
}

// The renderer asks whether an agent was granted access since it last asked, to show the
// notice once.
export function takeExternalAccessGrant(): boolean {
  const pending = pendingGrantNotice;
  pendingGrantNotice = false;
  return pending;
}
