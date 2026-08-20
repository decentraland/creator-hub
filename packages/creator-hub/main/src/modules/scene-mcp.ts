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

import { AI_SCENE_OP_REQUEST, AI_SCREENSHOT_REQUEST } from '/shared/types/ipc';
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

// Scene-mutation bridge: main → renderer → inspector-iframe SceneRpc. The renderer runs
// the real inspector operations on the live engine (so the viewport updates and undo +
// autosave come free), then answers via `ai.sceneOpResult`.
const SCENE_OP_TIMEOUT_MS = 15_000;
type SceneOpOutcome = { ok: boolean; payload: unknown };
const pendingSceneOps = new Map<
  string,
  { resolve: (v: SceneOpOutcome) => void; timer: NodeJS.Timeout }
>();
// Mutations must be serialized: the inspector host's StateManager throws on re-entrant
// transactions. Chain every op so only one is ever in flight.
let sceneOpChain: Promise<unknown> = Promise.resolve();

function requestSceneOpRaw(op: string, params: Record<string, unknown>): Promise<SceneOpOutcome> {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win === undefined || win.isDestroyed()) {
    return Promise.resolve({ ok: false, payload: 'No editor window is open.' });
  }
  const id = randomUUID();
  return new Promise<SceneOpOutcome>(resolve => {
    const timer = setTimeout(() => {
      pendingSceneOps.delete(id);
      resolve({ ok: false, payload: `Scene op "${op}" timed out (no editor response).` });
    }, SCENE_OP_TIMEOUT_MS);
    pendingSceneOps.set(id, { resolve, timer });
    win.webContents.send(AI_SCENE_OP_REQUEST, { id, op, params });
  });
}

// How many undo entries each mutating op adds to the shared history — used to size a
// per-turn "revert". Reads (scene_state, search_catalog, entity_detail) aren't here.
// place_smart_item is 2 (one file-import undo + one composite-spawn undo — catalog items
// always ship model files); everything else is a single dispatch = 1 entry.
const MUTATION_UNDO_COST: Record<string, number> = {
  create_entity: 1,
  remove_entity: 1,
  set_parent: 1,
  set_component: 1,
  remove_component: 1,
  attach_script: 1,
  place_smart_item: 2,
};

// Count of undo entries the current AI turn has applied to the scene graph. Reset when a
// turn starts (ai.ts), read into the `done` event, and used to size a revert.
let turnMutations = 0;
export function resetTurnMutations(): void {
  turnMutations = 0;
}
export function getTurnMutations(): number {
  return turnMutations;
}

function requestSceneOp(op: string, params: Record<string, unknown>): Promise<SceneOpOutcome> {
  const run = sceneOpChain
    .then(() => requestSceneOpRaw(op, params))
    .then(res => {
      if (res.ok && MUTATION_UNDO_COST[op] !== undefined) turnMutations += MUTATION_UNDO_COST[op];
      return res;
    });
  sceneOpChain = run.catch(() => undefined); // keep the chain alive past a rejection
  return run;
}

// Revert an AI turn's scene-graph changes by undoing `count` steps (serialized like any op).
export async function revertTurn(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const res = await requestSceneOp('undo', {});
    if (!res.ok) break; // nothing left to undo, or the editor went away
  }
}

// Called from the `ai.sceneOpResult` IPC handler when the renderer answers.
export function resolveSceneOp(id: string, ok: boolean, payload: unknown): void {
  const pending = pendingSceneOps.get(id);
  if (pending === undefined) return;
  clearTimeout(pending.timer);
  pendingSceneOps.delete(id);
  pending.resolve({ ok, payload });
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

  // ---- Scene-graph mutations (Phase 2) ----
  server.registerTool(
    'create_entity',
    {
      title: 'Create entity',
      description:
        'Add a new entity to the scene graph, optionally named and/or parented to another entity by id. Returns the new entity id. The change appears live in the editor, autosaves, and is undoable. Use scene_state first to see existing entities and pick a parent.',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe('Human-readable Name shown in the hierarchy (e.g. "Front Door")'),
        parent: z.number().optional().describe('Parent entity id; omit to place at the scene root'),
      },
    },
    async ({ name, parent }) => {
      const res = await requestSceneOp('create_entity', { name, parent });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'remove_entity',
    {
      title: 'Remove entity',
      description:
        'Delete an entity (and all its children) from the scene graph, by id. Live in the editor, autosaves, undoable. Use scene_state to find the id first.',
      inputSchema: { entity: z.number().describe('The entity id to remove') },
    },
    async ({ entity }) => {
      const res = await requestSceneOp('remove_entity', { entity });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'set_parent',
    {
      title: 'Set parent',
      description:
        'Reparent an entity under another (its world position is preserved). Use parent id 0 for the scene root. Live + undoable.',
      inputSchema: {
        entity: z.number().describe('The entity to reparent'),
        parent: z.number().describe('The new parent entity id (0 = scene root)'),
      },
    },
    async ({ entity, parent }) => {
      const res = await requestSceneOp('set_parent', { entity, parent });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'set_component',
    {
      title: 'Set component',
      description:
        'Create or update a component on an entity. `component` is a name like "Transform", "core::GltfContainer", "MeshRenderer", or "VisibilityComponent". `value` is the component value; for an UPDATE the keys you pass are merged. IMPORTANT: the value must match the component schema — call entity_detail on an entity that already has the component to see the exact shape (e.g. Transform is {position:{x,y,z},rotation:{x,y,z,w},scale:{x,y,z}}). Live + undoable.',
      inputSchema: {
        entity: z.number().describe('The entity id'),
        component: z.string().describe('Component name, e.g. "Transform" or "core::GltfContainer"'),
        value: z
          .record(z.string(), z.unknown())
          .describe('Component value (JSON object matching its schema)'),
      },
    },
    async ({ entity, component, value }) => {
      const res = await requestSceneOp('set_component', { entity, component, value });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'remove_component',
    {
      title: 'Remove component',
      description:
        'Remove a component from an entity, by component name (e.g. "MeshRenderer"). Live + undoable.',
      inputSchema: {
        entity: z.number().describe('The entity id'),
        component: z.string().describe('Component name to remove'),
      },
    },
    async ({ entity, component }) => {
      const res = await requestSceneOp('remove_component', { entity, component });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'search_catalog',
    {
      title: 'Search Smart Items catalog',
      description:
        'Search the Smart Items catalog (doors, buttons, platforms, NPCs, etc.) — pre-built items that carry their own behaviour. Returns matches with id, name, category, tags. Use before place_smart_item to get an assetId. Omit the query to list everything.',
      inputSchema: {
        query: z.string().optional().describe('Substring to match against name/category/tags/id'),
        limit: z.number().optional().describe('Max results (default 30)'),
      },
    },
    async ({ query, limit }) => {
      const res = await requestSceneOp('search_catalog', { query, limit });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'place_smart_item',
    {
      title: 'Place Smart Item',
      description:
        'Place a Smart Item from the catalog into the open scene. `assetId` comes from search_catalog. Optional `position` is world metres (defaults to 8,0,8). The item brings its own behaviour (e.g. a door that opens when clicked) — this is how you add interactive objects. Applies live, autosaves, undoable.',
      inputSchema: {
        assetId: z.string().describe('Catalog asset id (from search_catalog)'),
        name: z
          .string()
          .optional()
          .describe('Name for the placed entity (defaults to the asset name)'),
        position: z
          .object({ x: z.number(), y: z.number(), z: z.number() })
          .optional()
          .describe('World position in metres (default { x: 8, y: 0, z: 8 })'),
      },
    },
    async ({ assetId, name, position }) => {
      const res = await requestSceneOp('place_smart_item', { assetId, name, position });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
    },
  );

  server.registerTool(
    'attach_script',
    {
      title: 'Attach script',
      description:
        'Attach a script to an entity by adding an asset-packs::Script component pointing at a source file. WRITE THE SCRIPT FILE FIRST with your own file tools (put it under assets/Scripts/, e.g. assets/Scripts/Door.tsx), then call this with that path. Applies live, autosaves, undoable.',
      inputSchema: {
        entity: z.number().describe('The entity id to attach the script to'),
        path: z.string().describe('Path to the script file, e.g. "assets/Scripts/Door.tsx"'),
        priority: z.number().optional().describe('Execution priority (default 0)'),
      },
    },
    async ({ entity, path, priority }) => {
      const res = await requestSceneOp('attach_script', { entity, path, priority });
      if (!res.ok) return fail(String(res.payload));
      return ok(res.payload);
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
