// The Explorer gateway: the bridge that lets the embedded AI assistant drive a running
// Decentraland preview. It launches the Explorer preview with its `unity-explorer-mcp`
// server enabled (via `sdk-commands start --mcp --mcp-port <n>`), opens an MCP *client*
// connection to that server, and proxies its tools to the assistant through the Creator
// Hub MCP server (scene-mcp.ts). So the one MCP entrypoint the assistant talks to gains
// runtime verification — launch, look, walk, click, read logs/perf — without the agent
// having to self-register or reconnect anything.
//
// The Explorer's MCP server speaks standard MCP over streamable HTTP with no auth
// (localhost only) at http://127.0.0.1:<port>/unity-explorer-mcp, so a stock
// `@modelcontextprotocol/sdk` client connects directly.
import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log/main';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { supportsMcp } from '/shared/flags';
import { PREVIEW_CLIENT, type PreviewOptions } from '/shared/types/settings';
import { getPreview, killPreview, start } from './cli';
import { getAvailablePort } from './port';

// A launched-and-connected gateway. One at a time: a single editor window previews a
// single scene.
interface Gateway {
  projectDir: string;
  port: number;
  client: Client;
  transport: StreamableHTTPClientTransport;
  tools: ExplorerTool[];
}

export interface ExplorerTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface PreviewStatus {
  running: boolean; // the gateway has a connected MCP client to a live preview
  ready: boolean; // the scene has finished loading (get_scene_state → isReady)
  projectDir: string | null;
  port: number | null;
  tools: ExplorerTool[];
  message: string;
}

let gateway: Gateway | null = null;
// Serialize launches so two launch_preview calls ride one boot — but only when they're for the
// SAME project (a different project must wait its turn, not get the other project's result).
let launching: Promise<PreviewStatus> | null = null;
let launchingProject: string | null = null;

// Preview options the gateway launches with: the desktop (Unity) client, MCP on, and
// auth-screen skipped (uses a cached identity when there is one — a first-ever launch may
// still block on login, which readiness polling reports). The rest match the app defaults
// and don't affect MCP.
const GATEWAY_PREVIEW_OPTIONS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: true,
  openNewInstance: false,
  multiInstance: false,
  mcp: true,
  showWarnings: true,
  optimizedAssets: false,
  client: PREVIEW_CLIENT.DESKTOP,
};

// The Explorer app takes a while to boot after sdk-commands captures the deeplink, so the
// MCP HTTP server isn't listening immediately — retry the connect. Then the scene still
// has to load (and possibly the user log in), so poll readiness separately, longer.
const CONNECT_TIMEOUT_MS = 45_000;
const CONNECT_RETRY_MS = 1_500;
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 2_000;
const CALL_TIMEOUT_MS = 60_000; // a screenshot/perf sample can be slow

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Read the scene's installed @dcl/sdk version (which bundles @dcl/sdk-commands at the same
// number) to gate on the --mcp flag support.
async function installedSdkVersion(projectDir: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(
      path.join(projectDir, 'node_modules', '@dcl', 'sdk', 'package.json'),
      'utf8',
    );
    const v = (JSON.parse(raw) as { version?: string }).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

// Read one MCP tool result's text payload as JSON (the Explorer returns JSON-as-text in
// content[0].text). Null if it isn't shaped that way.
function readJsonResult(result: unknown): unknown {
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const text = content.find(
    (c): c is { type?: string; text?: string } =>
      typeof c === 'object' && c !== null && (c as { type?: unknown }).type === 'text',
  )?.text;
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isReadyState(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as { isReady?: unknown; loadingScreenOn?: unknown };
  return s.isReady === true && s.loadingScreenOn !== true;
}

async function connectWithRetry(port: number): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
}> {
  const url = new URL(`http://127.0.0.1:${port}/unity-explorer-mcp`);
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  let lastErr: unknown;
  for (;;) {
    const client = new Client({ name: 'creator-hub-gateway', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(url);
    try {
      await client.connect(transport);
      return { client, transport };
    } catch (e) {
      lastErr = e;
      await transport.close().catch(() => {});
      if (Date.now() >= deadline) throw lastErr;
      await delay(CONNECT_RETRY_MS);
    }
  }
}

// Poll get_scene_state until the scene is loaded, or the deadline passes. Returns whether
// it became ready; a false here usually means the Explorer is still on the login/auth
// screen or loading a heavy scene — not a hard failure.
async function pollReady(client: Client): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      const res = await client.callTool({ name: 'get_scene_state', arguments: {} });
      if (isReadyState(readJsonResult(res))) return true;
    } catch {
      /* server not answering yet — keep waiting */
    }
    if (Date.now() >= deadline) return false;
    await delay(READY_POLL_MS);
  }
}

async function teardown(g: Gateway): Promise<void> {
  await g.client.close().catch(() => {});
  await g.transport.close().catch(() => {});
  await killPreview(g.projectDir).catch(() => {});
}

async function doLaunch(projectDir: string): Promise<PreviewStatus> {
  const version = await installedSdkVersion(projectDir);
  if (!supportsMcp(version)) {
    return {
      running: false,
      ready: false,
      projectDir,
      port: null,
      tools: [],
      message:
        `This scene's @dcl/sdk (${version ?? 'not installed'}) is older than 7.25.0, which is ` +
        'required to launch a preview with the MCP server. Upgrade @dcl/sdk to 7.25.0 or newer.',
    };
  }

  // Reuse a live, connected gateway for the same scene (the assistant may call
  // launch_preview again mid-conversation just to get the tool list / status).
  if (gateway !== null && gateway.projectDir === projectDir) {
    const preview = getPreview(projectDir);
    if (preview?.child.alive()) {
      const ready = await pollReady(gateway.client);
      return status(ready);
    }
    await teardown(gateway); // the preview died out from under us — start fresh
    gateway = null;
  }

  // A different scene, or a stale gateway — tear it down first.
  if (gateway !== null) {
    await teardown(gateway);
    gateway = null;
  }

  // Force a fresh preview: an already-running preview for this path (e.g. the user pressed
  // Preview) is reused by start() without restarting and would not have the MCP server on
  // our port. Kill it so start() spawns a new one with --mcp --mcp-port.
  await killPreview(projectDir).catch(() => {});

  const port = await getAvailablePort();
  log.info(`[Gateway] launching preview for ${projectDir} with MCP on :${port}`);
  await start(projectDir, { ...GATEWAY_PREVIEW_OPTIONS, mcpPort: port });

  let client: Client;
  let transport: StreamableHTTPClientTransport;
  try {
    ({ client, transport } = await connectWithRetry(port));
  } catch (e) {
    await killPreview(projectDir).catch(() => {});
    return {
      running: false,
      ready: false,
      projectDir,
      port,
      tools: [],
      message:
        'The preview launched but its MCP server never answered. The Explorer may still be ' +
        `starting, or this build has no MCP support. (${String(e)})`,
    };
  }

  let tools: ExplorerTool[] = [];
  try {
    const listed = await client.listTools();
    tools = listed.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  } catch (e) {
    log.warn('[Gateway] tools/list failed:', e);
  }

  gateway = { projectDir, port, client, transport, tools };
  // If the Explorer crashes or is closed, the transport closes — drop the dead gateway so
  // callExplorerTool stops failing forever and a later launch_preview starts fresh.
  transport.onclose = () => {
    if (gateway?.transport === transport) {
      log.info('[Gateway] Explorer MCP connection closed; clearing gateway');
      gateway = null;
      notifyExplorerToolsChanged();
    }
  };
  notifyExplorerToolsChanged(); // the explorer_* tools are now available to register
  const ready = await pollReady(client);
  return status(ready);
}

function status(ready: boolean): PreviewStatus {
  if (gateway === null) {
    return {
      running: false,
      ready: false,
      projectDir: null,
      port: null,
      tools: [],
      message: 'No preview is running. Call launch_preview to start one.',
    };
  }
  return {
    running: true,
    ready,
    projectDir: gateway.projectDir,
    port: gateway.port,
    tools: gateway.tools,
    message: ready
      ? 'Preview is running and the scene is loaded. Drive it with explorer_call.'
      : 'Preview is running but the scene is not ready yet — the Explorer may be on the ' +
        'login screen or still loading. Call preview_status again in a few seconds, or ' +
        'explorer_call get_scene_state to check.',
  };
}

// The Explorer tools currently available to proxy (empty when no preview is connected).
// The MCP server registers one `explorer_<name>` tool per entry and re-syncs on change.
export function explorerTools(): ExplorerTool[] {
  return gateway?.tools ?? [];
}

// Listeners notified whenever the proxied tool set changes (a preview connected or stopped),
// so the MCP server can add/remove its `explorer_*` tools and push tools/list_changed.
const toolsChangedListeners = new Set<() => void>();
export function onExplorerToolsChanged(cb: () => void): () => void {
  toolsChangedListeners.add(cb);
  return () => toolsChangedListeners.delete(cb);
}
function notifyExplorerToolsChanged(): void {
  for (const cb of toolsChangedListeners) {
    try {
      cb();
    } catch (e) {
      log.warn('[Gateway] tools-changed listener threw:', e);
    }
  }
}

// Launch (or reuse) a preview for the scene with its MCP server, connect to it, and report
// readiness + the proxied tool catalog. Serialized so concurrent calls ride one boot.
export function launchPreview(projectDir: string): Promise<PreviewStatus> {
  // Ride an in-flight launch only if it's for the same project; a different project chains
  // after it (one preview at a time) rather than silently receiving the other's status.
  if (launching !== null && launchingProject === projectDir) return launching;
  const prior = launching ?? Promise.resolve();
  launchingProject = projectDir;
  const run: Promise<PreviewStatus> = prior.catch(() => undefined).then(() => doLaunch(projectDir));
  launching = run;
  void run.finally(() => {
    if (launching === run) {
      launching = null;
      launchingProject = null;
    }
  });
  return run;
}

export async function stopPreview(): Promise<void> {
  if (gateway === null) return;
  const g = gateway;
  gateway = null;
  notifyExplorerToolsChanged(); // the explorer_* tools are gone now
  await teardown(g);
}

// Report whether a preview is running/ready without launching one. Re-checks readiness
// against the live connection.
export async function previewStatus(): Promise<PreviewStatus> {
  if (gateway === null) return status(false);
  const preview = getPreview(gateway.projectDir);
  if (!preview?.child.alive()) {
    // died out from under us
    await stopPreview();
    return status(false);
  }
  const ready = await pollReady(gateway.client);
  return status(ready);
}

// Proxy one tool call to the running Explorer. Returns the raw MCP result (content blocks,
// images included) so scene-mcp.ts can hand it straight back to the assistant.
export async function callExplorerTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content?: unknown[]; isError?: boolean }> {
  if (gateway === null) {
    throw new Error('No preview is running. Call launch_preview first.');
  }
  return gateway.client.callTool({ name, arguments: args }, undefined, {
    timeout: CALL_TIMEOUT_MS,
  }) as Promise<{ content?: unknown[]; isError?: boolean }>;
}

export function gatewayProject(): string | null {
  return gateway?.projectDir ?? null;
}

// Tear the gateway down on app quit / when the open project changes out from under it.
export async function stopExplorerGateway(): Promise<void> {
  await stopPreview();
}
