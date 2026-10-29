// Let an AI agent running OUTSIDE the Hub — Claude Code in a terminal or VS Code, Codex,
// Claude Desktop — find and use the scene MCP server (scene-mcp.ts), with no human copying a
// URL + token out of Settings. Opt-in: nothing is exposed until the creator turns on
// "Allow AI agents outside Creator Hub". While it is on, `<userData>/mcp-server.json` holds
// the url + token for any agent on this machine.
//
// An agent can ask for access by creating `<userData>/mcp-server.request`. That never grants
// anything by itself: the creator is asked in the app, and only their "Allow" turns it on.
//
// Turning access off revokes it: the external token is dropped (live outside sessions close)
// and the discovery file is removed. The in-app assistant has its own token and is unaffected
// either way. Nothing is written into scene folders.
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';

import { AI_EXTERNAL_ACCESS_CHANGED, AI_EXTERNAL_ACCESS_REQUESTED } from '/shared/types/ipc';
import { MAIN_WINDOW_ID } from '../mainWindow';
import { getConfig } from './config';
import { getUserDataPath } from './electron';
import {
  getExternalMcpInfo,
  type SceneMcpInfo,
  setExternalMcpAccess,
  setSceneMcpProject,
} from './scene-mcp';
import { getWindow } from './window';

export const MCP_DISCOVERY_FILE = 'mcp-server.json';
export const MCP_ACCESS_REQUEST_FILE = 'mcp-server.request';

export interface McpDiscoveryInfo extends SceneMcpInfo {
  pid: number;
  startedAt: string;
  version: string;
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
// When access was last granted, for the discovery file's `startedAt`.
let grantedAt: string | null = null;
// An agent asked for access and the renderer hasn't asked the creator yet. Pulled rather than
// only pushed, so a request made before the window loaded still gets its prompt.
let pendingAccessRequest = false;

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

// Grant outside access and write the discovery file for the running server (starting it if
// needed). Best-effort: a write failure degrades to "copy it from Settings", never a hard stop.
async function publish(): Promise<void> {
  setExternalMcpAccess(true);
  pendingAccessRequest = false;
  // Null if access was revoked while the server started, so a quick on→off never leaves a file.
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
  notifyRenderer(AI_EXTERNAL_ACCESS_CHANGED);
}

// Revoke outside access and remove the discovery file.
function withdraw(): void {
  setExternalMcpAccess(false);
  grantedAt = null;
  clearMcpDiscovery();
  notifyRenderer(AI_EXTERNAL_ACCESS_CHANGED);
}

function notifyRenderer(channel: string): void {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.webContents.send(channel);
}

// Called once at app start: expose the server if the creator left access on, then start
// listening for agents that ask for it.
export async function initMcpDiscovery(): Promise<void> {
  if (await exposeEnabled()) await publish();
  watchAccessRequests();
}

// A scene was opened in the editor. Point the server at it right away, so an outside agent's
// tools work before any in-app turn ran.
export function sceneOpened(projectDir: string): void {
  openProjectDir = projectDir;
  setSceneMcpProject(projectDir);
}

// The editor left the scene. Detach the server, so outside tools answer "No scene is open."
// instead of acting on a closed scene.
export function sceneClosed(projectDir: string): void {
  if (openProjectDir !== projectDir) return;
  openProjectDir = null;
  setSceneMcpProject(null);
}

// The `exposeMcpServer` setting changed (from Settings, or the creator allowed an agent's
// request).
export async function syncExposeMcpServer(enabled: boolean): Promise<void> {
  if (enabled) await publish();
  else withdraw();
}

// Stop advertising the server — on quit, and when access goes off. Synchronous so it
// completes inside the quit path.
export function clearMcpDiscovery(): void {
  try {
    removeMcpDiscoveryFile(discoveryFilePath());
  } catch (e) {
    log.warn('[MCP] could not remove the discovery file:', e);
  }
}

// --- Access requested by an agent --------------------------------------------------------

// An agent created `<userData>/mcp-server.request`. If access is already on, refresh the
// discovery file (the agent may have found it missing). Otherwise ask the creator; nothing is
// granted until they allow it. The request file is consumed either way.
async function handleAccessRequest(): Promise<void> {
  const file = accessRequestFilePath();
  if (!fs.existsSync(file)) return;
  fs.rmSync(file, { force: true });
  if (await exposeEnabled()) {
    await publish();
    return;
  }
  log.info('[MCP] an AI agent asked for outside access; asking the creator');
  pendingAccessRequest = true;
  notifyRenderer(AI_EXTERNAL_ACCESS_REQUESTED);
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
    // An unhandled 'error' (EPERM on Windows, the folder going away) would crash the main
    // process. Requests then only get picked up on the next launch.
    requestWatcher.on('error', e => {
      log.warn('[MCP] stopped watching for agent access requests:', e);
      stopWatchingAccessRequests();
    });
  } catch (e) {
    log.warn('[MCP] cannot watch for agent access requests:', e);
  }
}

export function stopWatchingAccessRequests(): void {
  requestWatcher?.close();
  requestWatcher = null;
}

// The renderer asks whether an agent is waiting for the creator's answer, to ask them once.
export function takeExternalAccessRequest(): boolean {
  const pending = pendingAccessRequest;
  pendingAccessRequest = false;
  return pending;
}
