// The Creator Hub MCP server: the single MCP entrypoint the embedded AI assistant
// talks to. It runs inside the Electron main process (localhost HTTP + a bearer token),
// so it has direct access to the open project and — in later phases — to the renderer
// and Explorer preview.
//
// Phase 1 exposes read-only tools only: project metadata and the scene graph, read
// straight from disk (see scene-composite.ts). The server is started once, lazily, and
// its config is handed to the `claude` CLI via `--mcp-config`.
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import log from 'electron-log/main';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { AI_SCREENSHOT_REQUEST } from '/shared/types/ipc';
import { MAIN_WINDOW_ID } from '../mainWindow';
import { getWindow } from './window';
import { buildRoster, entityDetail, projectInfo, readComposite } from './scene-composite';

export interface SceneMcpInfo {
  url: string;
  token: string;
}

// The project the tools operate on. Set by the AI module when a turn starts; a single
// editor window means a single open project at a time.
let currentProjectDir: string | null = null;
export function setSceneMcpProject(projectDir: string | null): void {
  currentProjectDir = projectDir;
}

const MAX_ROSTER_ROWS = 200;
const SCREENSHOT_TIMEOUT_MS = 12_000;

// `editor_screenshot` bridge: the renderer owns the inspector iframe, so main asks it to
// capture and waits for the answer, correlated by request id.
const pendingScreenshots = new Map<
  string,
  { resolve: (v: string | null) => void; timer: NodeJS.Timeout }
>();

function requestEditorScreenshot(width: number, height: number): Promise<string | null> {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win === undefined || win.isDestroyed()) return Promise.resolve(null);
  const id = randomUUID();
  return new Promise<string | null>(resolve => {
    const timer = setTimeout(() => {
      pendingScreenshots.delete(id);
      resolve(null); // renderer never answered (not ready, or a renderer with no screenshot RPC)
    }, SCREENSHOT_TIMEOUT_MS);
    pendingScreenshots.set(id, { resolve, timer });
    win.webContents.send(AI_SCREENSHOT_REQUEST, { id, width, height });
  });
}

// Called from the `ai.screenshotResult` IPC handler when the renderer answers.
export function resolveEditorScreenshot(id: string, dataUrl: string | null): void {
  const pending = pendingScreenshots.get(id);
  if (pending === undefined) return;
  clearTimeout(pending.timer);
  pendingScreenshots.delete(id);
  pending.resolve(dataUrl);
}

// A tool result is either a JSON payload (rendered as text) or an error the model can
// read and recover from.
function ok(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}
function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function registerTools(server: McpServer): void {
  server.registerTool(
    'get_project_info',
    {
      title: 'Get project info',
      description:
        'Scene metadata (name, parcels, base, spawn points) and the project’s SDK version and dependencies. Read this to understand the scene’s layout before making changes.',
      inputSchema: {},
    },
    async () => {
      if (currentProjectDir === null) return fail('No scene is open.');
      try {
        return ok(projectInfo(currentProjectDir));
      } catch (e) {
        return fail(`Failed to read project info: ${String(e)}`);
      }
    },
  );

  server.registerTool(
    'scene_state',
    {
      title: 'Scene state',
      description:
        'The roster of authored entities in the open scene: id, name, kind, world transform, components, GLTF source, and whether each is a Smart Item. Read this to see what already exists before adding or editing anything.',
      inputSchema: {},
    },
    async () => {
      if (currentProjectDir === null) return fail('No scene is open.');
      try {
        const { entities, total } = buildRoster(readComposite(currentProjectDir));
        const shown = entities.slice(0, MAX_ROSTER_ROWS);
        return ok({
          total,
          shown: shown.length,
          truncated:
            total > shown.length ? `showing first ${shown.length} of ${total} entities` : undefined,
          entities: shown,
        });
      } catch (e) {
        return fail(String(e instanceof Error ? e.message : e));
      }
    },
  );

  server.registerTool(
    'entity_detail',
    {
      title: 'Entity detail',
      description:
        'Every component value for one entity, resolved by its numeric id or its Name (case-insensitive). Use after scene_state when you need the full component data for a specific entity.',
      inputSchema: {
        entity: z.string().describe('The entity id (e.g. "512") or its Name (e.g. "Front Door")'),
      },
    },
    async ({ entity }) => {
      if (currentProjectDir === null) return fail('No scene is open.');
      try {
        const detail = entityDetail(readComposite(currentProjectDir), entity);
        if (detail === null) return fail(`No entity found matching "${entity}".`);
        return ok(detail);
      } catch (e) {
        return fail(String(e instanceof Error ? e.message : e));
      }
    },
  );

  server.registerTool(
    'editor_screenshot',
    {
      title: 'Editor screenshot',
      description:
        'Capture the current editor viewport as a PNG. Use it to see the scene the way the user does — to verify a visual change or understand layout. Fast and needs no preview. Returns an error under the Bevy renderer, which has no screenshot support here.',
      inputSchema: {
        width: z.number().optional().describe('Image width in px (default 1280)'),
        height: z.number().optional().describe('Image height in px (default 720)'),
      },
    },
    async ({ width, height }) => {
      const dataUrl = await requestEditorScreenshot(
        Math.round(width ?? 1280),
        Math.round(height ?? 720),
      );
      if (dataUrl === null || dataUrl === '') {
        return fail(
          'Could not capture the editor viewport (no editor window, or the current renderer has no screenshot support).',
        );
      }
      const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl);
      const mimeType = m !== null ? m[1] : 'image/png';
      const data = m !== null ? m[2] : dataUrl; // tolerate a raw base64 string too
      return { content: [{ type: 'image' as const, data, mimeType }] };
    },
  );
}

let starting: Promise<SceneMcpInfo> | null = null;
let httpServer: http.Server | null = null;
let info: SceneMcpInfo | null = null;
const AUTH_TOKEN = randomBytes(24).toString('hex');

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Start the MCP server once and return its localhost URL + token. Idempotent: repeat
// callers share the same in-flight/settled start.
export function ensureSceneMcpServer(): Promise<SceneMcpInfo> {
  if (info !== null) return Promise.resolve(info);
  if (starting !== null) return starting;

  starting = (async () => {
    httpServer = http.createServer((req, res) => {
      void (async () => {
        // Only /mcp, and only with our bearer token — this port is localhost but a token
        // keeps other local processes from driving the editor.
        const auth = req.headers.authorization ?? '';
        if (auth !== `Bearer ${AUTH_TOKEN}`) {
          res.writeHead(401).end('Unauthorized');
          return;
        }
        const url = req.url ?? '';
        if (!url.startsWith('/mcp')) {
          res.writeHead(404).end('Not found');
          return;
        }
        // Stateless: a fresh McpServer + transport per POST. A single shared stateful
        // transport rejects any second `initialize` ("Server already initialized"),
        // which breaks the CLI client — so every request stands on its own. We serve
        // request/response only (no SSE session), which is all the read tools need.
        if (req.method !== 'POST') {
          res.writeHead(405).end('Method not allowed');
          return;
        }
        try {
          const raw = await readBody(req);
          const parsed = raw === '' ? undefined : JSON.parse(raw);
          const server = new McpServer({ name: 'creator-hub', version: '1.0.0' });
          registerTools(server);
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          res.on('close', () => {
            void transport.close();
            void server.close();
          });
          await server.connect(transport);
          await transport.handleRequest(req, res, parsed);
        } catch (e) {
          log.error('[MCP] request failed:', e);
          if (!res.headersSent) res.writeHead(500).end('Internal error');
        }
      })();
    });

    await new Promise<void>((resolve, reject) => {
      httpServer!.once('error', reject);
      httpServer!.listen(0, '127.0.0.1', resolve);
    });
    const addr = httpServer!.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    info = { url: `http://127.0.0.1:${port}/mcp`, token: AUTH_TOKEN };
    log.info(`[MCP] Creator Hub MCP server listening on ${info.url}`);
    return info;
  })();

  return starting;
}

export function stopSceneMcpServer(): void {
  httpServer?.close();
  httpServer = null;
  info = null;
  starting = null;
}

// Write the `--mcp-config` file the CLI reads: our server under the name `creator-hub`,
// as an HTTP MCP server with the bearer token. One file per app run, reused across turns.
let configPath: string | null = null;
export function writeSceneMcpConfigFile(mcp: SceneMcpInfo): string {
  if (configPath !== null) return configPath;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-hub-mcp-'));
  const file = path.join(dir, 'mcp-config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: {
        'creator-hub': {
          type: 'http',
          url: mcp.url,
          headers: { Authorization: `Bearer ${mcp.token}` },
        },
      },
    }),
  );
  configPath = file;
  return file;
}
