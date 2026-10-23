// Make the scene MCP server (scene-mcp.ts) discoverable by an AI agent running OUTSIDE the
// Hub — Claude Code in a terminal or VS Code, Codex, Claude Desktop — with no human copying
// the URL + token out of Settings. Two files, each written only while `exposeMcpServer` is on:
//
//   • `<project>/.mcp.json` — Claude Code's project-scope MCP config. Zero-touch for a client
//     started in the scene folder. Modelled on the Cursor writer in ai.ts (`.cursor/mcp.json`):
//     merged into the user's own servers, 0600, .gitignore'd BEFORE it exists.
//   • `<userData>/mcp-server.json` — a universal fallback any agent can read and self-register
//     from, independent of where it was started.
//
// Trust boundary: both files are readable by the same OS user only — the same boundary as the
// existing Cursor file and Electron's cookie store. The token rotates on every launch and the
// port is localhost-only, so a leaked file is dead the moment the Hub that wrote it quits.
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';

import { getConfig } from './config';
import { getUserDataPath } from './electron';
import {
  ensureSceneMcpServer,
  onSceneMcpStarted,
  type SceneMcpInfo,
  setSceneMcpProject,
} from './scene-mcp';

export const MCP_SERVER_NAME = 'creator-hub';
export const CLAUDE_MCP_CONFIG_FILE = '.mcp.json';
export const MCP_DISCOVERY_FILE = 'mcp-server.json';

export interface McpDiscoveryInfo extends SceneMcpInfo {
  pid: number;
  startedAt: string;
  version: string;
}

function readJsonObject(file: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    /* no file yet, or invalid JSON — start fresh */
  }
  return {};
}

function serversOf(config: Record<string, unknown>): Record<string, unknown> {
  return config.mcpServers !== null && typeof config.mcpServers === 'object'
    ? (config.mcpServers as Record<string, unknown>)
    : {};
}

// Keep a token-bearing file out of version control. Idempotent: appends only when nothing
// already ignores it. Mirrors ai.ts's Cursor helper; the file is 0600 regardless.
function ensureGitignored(projectDir: string, entry: string): void {
  const gitignore = path.join(projectDir, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gitignore, 'utf8');
  } catch {
    /* no .gitignore yet — created below */
  }
  const ignores = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .some(l => l === entry || l === `/${entry}`);
  if (ignores) return;
  const prefix = content === '' || content.endsWith('\n') ? content : `${content}\n`;
  fs.writeFileSync(
    gitignore,
    `${prefix}\n# Creator Hub AI assistant — holds a local MCP token, do not commit\n${entry}\n`,
  );
}

// Claude Code reads `<project>/.mcp.json` (project scope) on session start. It has no token
// indirection for HTTP servers, so the bearer token sits literally in the file: write it 0600
// and gitignore it first, so there is no window where a secret-bearing file is tracked.
// Merge to preserve the user's own servers. Scene templates' `.dclignore` ignores `.*`, so
// the file never ships with a deployed scene either.
export function writeClaudeMcpConfig(projectDir: string, mcp: SceneMcpInfo): void {
  const file = path.join(projectDir, CLAUDE_MCP_CONFIG_FILE);
  const config = readJsonObject(file);
  config.mcpServers = {
    ...serversOf(config),
    [MCP_SERVER_NAME]: {
      type: 'http',
      url: mcp.url,
      headers: { Authorization: `Bearer ${mcp.token}` },
    },
  };
  ensureGitignored(projectDir, CLAUDE_MCP_CONFIG_FILE);
  // mode:0600 applies only when creating the file; an existing user file keeps its own perms.
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

// Drop only OUR entry from `<project>/.mcp.json`; the user's servers stay. The file goes
// too when nothing else is in it, so an opted-out scene is left exactly as we found it.
export function removeClaudeMcpConfig(projectDir: string): void {
  const file = path.join(projectDir, CLAUDE_MCP_CONFIG_FILE);
  if (!fs.existsSync(file)) return;
  const config = readJsonObject(file);
  const servers = serversOf(config);
  if (!(MCP_SERVER_NAME in servers)) return;
  const rest = { ...servers };
  delete rest[MCP_SERVER_NAME];
  const otherKeys = Object.keys(config).filter(k => k !== 'mcpServers');
  if (Object.keys(rest).length === 0 && otherKeys.length === 0) {
    fs.rmSync(file, { force: true });
    return;
  }
  config.mcpServers = rest;
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

export function discoveryFilePath(userDataDir: string = getUserDataPath()): string {
  return path.join(userDataDir, MCP_DISCOVERY_FILE);
}

// `pid` lets a reader tell a live file from one a crashed Hub left behind; `startedAt` and
// `version` are there for the same diagnosis. A stale file is simply overwritten on the next
// start, so a crash never needs manual cleanup.
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

async function exposeEnabled(): Promise<boolean> {
  try {
    return (await getConfig()).settings.exposeMcpServer === true;
  } catch (e) {
    log.warn('[MCP] could not read settings, not publishing the server:', e);
    return false;
  }
}

function publishDiscoveryFile(mcp: SceneMcpInfo): void {
  try {
    writeMcpDiscoveryFile(discoveryFilePath(), {
      ...mcp,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      version: app.getVersion(),
    });
  } catch (e) {
    log.warn('[MCP] could not write the discovery file:', e);
  }
}

function publishProjectFile(projectDir: string, mcp: SceneMcpInfo): void {
  try {
    writeClaudeMcpConfig(projectDir, mcp);
  } catch (e) {
    log.warn(`[MCP] could not write ${CLAUDE_MCP_CONFIG_FILE} into ${projectDir}:`, e);
  }
}

// Write both files for the running server (starting it if needed). No-op while the setting
// is off. Best-effort: a write failure degrades to "copy it from Settings", never a hard stop.
async function publish(): Promise<void> {
  if (!(await exposeEnabled())) return;
  let mcp: SceneMcpInfo;
  try {
    mcp = await ensureSceneMcpServer();
  } catch (e) {
    log.warn('[MCP] server unavailable, nothing to publish for external agents:', e);
    return;
  }
  publishDiscoveryFile(mcp);
  if (openProjectDir !== null) publishProjectFile(openProjectDir, mcp);
}

// Called once at app start. Whenever the server comes up — for whatever reason — the
// discovery file follows, so an agent reading it always finds the live URL + token.
export function initMcpDiscovery(): void {
  onSceneMcpStarted(mcp => {
    void exposeEnabled().then(enabled => {
      if (enabled) publishDiscoveryFile(mcp);
    });
  });
}

// A scene was opened in the editor. The server is pointed at it right away so an external
// agent's tools work before any in-app turn ran (setSceneMcpProject used to happen only at
// the start of an embedded turn), and the project file is written while the setting is on.
export async function sceneOpened(projectDir: string): Promise<void> {
  openProjectDir = projectDir;
  setSceneMcpProject(projectDir);
  await publish();
}

// The editor window left the scene. The project file is deliberately left in place (same as
// the Cursor file): its token is dead after the next launch anyway, and it comes back on the
// next open. Only forget which project a later setting flip should write into.
export function sceneClosed(projectDir: string): void {
  if (openProjectDir === projectDir) openProjectDir = null;
}

// The `exposeMcpServer` setting changed. Turning it on publishes for the open scene (and
// starts the server if it isn't up yet); turning it off withdraws both files so nothing on
// disk advertises a server the creator asked us not to expose.
export async function syncExposeMcpServer(enabled: boolean): Promise<void> {
  if (enabled) {
    await publish();
    return;
  }
  clearMcpDiscovery();
  if (openProjectDir === null) return;
  try {
    removeClaudeMcpConfig(openProjectDir);
  } catch (e) {
    log.warn(`[MCP] could not remove ${CLAUDE_MCP_CONFIG_FILE} from ${openProjectDir}:`, e);
  }
}

// Withdraw the discovery file — on quit (with the server), and when the setting goes off.
export function clearMcpDiscovery(): void {
  try {
    removeMcpDiscoveryFile(discoveryFilePath());
  } catch (e) {
    log.warn('[MCP] could not remove the discovery file:', e);
  }
}
