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
import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type CallToolResult, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodRawShape, type ZodTypeAny } from 'zod';

import {
  AI_ASK_REQUEST,
  AI_SCENE_OP_REQUEST,
  AI_SCREENSHOT_REQUEST,
  type AiAskRequest,
} from '/shared/types/ipc';
import { MAIN_WINDOW_ID } from '../mainWindow';
import { getWindow } from './window';
import { buildRoster, entityDetail, projectInfo, readComposite } from './scene-composite';
import {
  callExplorerTool,
  type ExplorerTool,
  explorerTools,
  gatewayProject,
  launchPreview,
  onExplorerToolsChanged,
  previewStatus,
  stopExplorerGateway,
  stopPreview,
} from './explorer-gateway';

export interface SceneMcpInfo {
  url: string;
  token: string;
}

// The project the tools operate on. Set by the AI module when a turn starts; a single
// editor window means a single open project at a time.
let currentProjectDir: string | null = null;
export function setSceneMcpProject(projectDir: string | null): void {
  // A running Explorer preview belongs to one scene; if the open project changed, tear the
  // gateway down so a later launch_preview starts fresh against the new scene.
  const running = gatewayProject();
  if (running !== null && running !== projectDir) void stopExplorerGateway();
  currentProjectDir = projectDir;
}

const MAX_ROSTER_ROWS = 200;
const SCREENSHOT_TIMEOUT_MS = 12_000;
// Cap the request body so a buggy/compromised MCP client can't OOM the main process, and cap
// live sessions so a client that opens without closing (or crashes) can't leak them forever.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_SESSIONS = 32;

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

// Compositor capture of a window region → PNG data URL. Used as the editor-screenshot
// fallback for the Bevy renderer, whose wgpu canvas can't be read via canvas.toDataURL and
// whose engine `/screenshot` command may be unavailable (#1526). capturePage snapshots the
// composited frame, so it sees the wgpu canvas (and cross-origin iframes) unlike a DOM
// readback. The renderer supplies the viewport rect in the window's CSS px.
export async function captureViewport(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win === undefined || win.isDestroyed()) return null;
  const r = {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
  try {
    const img = await win.webContents.capturePage(r);
    const size = img.getSize();
    if (size.width === 0 || size.height === 0) return null;
    return img.toDataURL();
  } catch {
    return null; // capture unavailable (window hidden/occluded, etc.) — the tool reports it
  }
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
  set_scene_settings: 1,
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

// The inspector autosaves the composite to disk ~100ms after an engine change (debounced).
// The read tools (scene_state/entity_detail) read that file, so after a mutation we wait a
// beat before resolving — otherwise an AI that mutates then immediately reads sees stale data.
const AUTOSAVE_SETTLE_MS = 300;

function requestSceneOp(op: string, params: Record<string, unknown>): Promise<SceneOpOutcome> {
  const run = sceneOpChain
    .then(() => requestSceneOpRaw(op, params))
    .then(async res => {
      if (res.ok && MUTATION_UNDO_COST[op] !== undefined) {
        turnMutations += MUTATION_UNDO_COST[op];
        // let the disk autosave catch up so a subsequent scene_state read is fresh
        await new Promise(r => setTimeout(r, AUTOSAVE_SETTLE_MS));
      }
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

// Interactive `ask_user` bridge: the tool asks the chat panel a question and blocks until the
// user answers (or dismisses / the turn is stopped). Long timeout — a person may take a while.
const ASK_TIMEOUT_MS = 10 * 60_000;
const pendingAsks = new Map<
  string,
  { resolve: (v: string | null) => void; timer: NodeJS.Timeout }
>();

function requestUserPrompt(req: Omit<AiAskRequest, 'id'>): Promise<string | null> {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win === undefined || win.isDestroyed()) return Promise.resolve(null);
  const id = randomUUID();
  return new Promise<string | null>(resolve => {
    const timer = setTimeout(() => {
      pendingAsks.delete(id);
      resolve(null); // no answer in time — the tool reports a dismissal
    }, ASK_TIMEOUT_MS);
    pendingAsks.set(id, { resolve, timer });
    const payload: AiAskRequest = { id, ...req };
    win.webContents.send(AI_ASK_REQUEST, payload);
  });
}

// Called from the `ai.askResult` IPC handler when the user answers (null = dismissed).
export function resolveUserPrompt(id: string, answer: string | null): void {
  const pending = pendingAsks.get(id);
  if (pending === undefined) return;
  clearTimeout(pending.timer);
  pendingAsks.delete(id);
  pending.resolve(answer);
}

// Resolve every outstanding prompt as dismissed — called when a turn is stopped/killed so a
// blocked `ask_user` can't hang the (now-dead) agent's tool call.
export function clearPendingAsks(): void {
  for (const pending of pendingAsks.values()) {
    clearTimeout(pending.timer);
    pending.resolve(null);
  }
  pendingAsks.clear();
}

// A tool result is either a JSON payload (rendered as text) or an error the model can
// read and recover from.
function ok(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}
function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
// One consistent way to stringify a thrown value for a tool error.
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Register a tool whose whole job is to run one scene-op over the renderer→inspector bridge and
// return its result (or the error). The tool name IS the op name and its args ARE the op params,
// so every such tool is a one-liner instead of the repeated request/check/ok/fail boilerplate.
function registerSceneOpTool(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: ZodRawShape },
): void {
  server.registerTool(name, config, async (args: Record<string, unknown>) => {
    const res = await requestSceneOp(name, args);
    return res.ok ? ok(res.payload) : fail(String(res.payload));
  });
}

// Pass an Explorer tool's own MCP content blocks straight back to the assistant (text +
// images). They come from a compliant MCP server so they already match the content-block
// shape; assert to the SDK's content type (not `never`) so a shape change surfaces here.
function formatExplorerResult(res: { content?: unknown[]; isError?: boolean }) {
  const content = Array.isArray(res.content) ? res.content : [];
  if (content.length === 0) {
    return { content: [{ type: 'text' as const, text: '(no content returned)' }] };
  }
  return { content: content as CallToolResult['content'], isError: res.isError };
}

function registerTools(server: McpServer): void {
  server.registerTool(
    'ask_user',
    {
      title: 'Ask the user',
      description:
        'Ask the user a question and WAIT for their answer, shown as an interactive prompt in the chat. Use this whenever you need a decision only the user can make — choosing between approaches, confirming intent, or filling in missing information — instead of guessing or stopping the turn. Give 2–4 short, distinct options for a choice; set multiSelect to let them pick several; set allowOther (or omit options entirely) to accept a typed answer. Returns the user’s answer as text.',
      inputSchema: {
        question: z.string().describe('The question to ask the user.'),
        options: z
          .array(z.object({ label: z.string(), description: z.string().optional() }))
          .optional()
          .describe('2–4 concise choices. Omit for a free-text question.'),
        multiSelect: z.boolean().optional().describe('Allow selecting more than one option.'),
        allowOther: z.boolean().optional().describe('Also offer a free-text answer.'),
      },
    },
    async ({ question, options, multiSelect, allowOther }) => {
      const opts = options ?? [];
      const answer = await requestUserPrompt({
        question,
        options: opts,
        multiSelect: multiSelect ?? false,
        allowOther: allowOther ?? opts.length === 0,
      });
      if (answer === null || answer === '') {
        return fail('The user dismissed the question without answering.');
      }
      return ok({ answer });
    },
  );

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
        return ok(await projectInfo(currentProjectDir));
      } catch (e) {
        return fail(`Failed to read project info: ${errMsg(e)}`);
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
        const { entities, total } = buildRoster(await readComposite(currentProjectDir));
        const shown = entities.slice(0, MAX_ROSTER_ROWS);
        return ok({
          total,
          shown: shown.length,
          truncated:
            total > shown.length ? `showing first ${shown.length} of ${total} entities` : undefined,
          entities: shown,
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    },
  );

  registerSceneOpTool(server, 'get_scene_metrics', {
    title: 'Scene metrics',
    description:
      "The editor's live scene budget: triangles, entities, bodies, materials and textures currently in the scene, each against its per-scene limit, plus the count of entities out of the scene's bounds. Use this to check the scene fits Decentraland's limits before/after adding content. Measured by the editor viewport (needs no preview); for a running scene's frame rate and per-model breakdown, launch_preview and use explorer_call get_performance_stats / get_scene_content_stats.",
    inputSchema: {},
  });

  registerSceneOpTool(server, 'get_selection', {
    title: 'Get current selection',
    description:
      'The entities the user currently has selected in the editor (id + name). Use this to resolve what the user means by "this", "the selected entity", or "the one I have open" before acting. Returns an empty list if nothing is selected.',
    inputSchema: {},
  });

  registerSceneOpTool(server, 'get_scene_settings', {
    title: 'Get scene settings',
    description:
      "The scene's settings (from scene.json / the editor's Scene metadata): name, description, categories, tags, age rating, spawn points, skybox, terrain, layout (parcels), and voice-chat/portable-experience flags. Read this before set_scene_settings to see the exact current shape and values.",
    inputSchema: {},
  });

  registerSceneOpTool(server, 'set_scene_settings', {
    title: 'Set scene settings',
    description:
      'Change the scene settings (scene.json / Scene metadata). Include only the fields you want to change — each is replaced wholesale (call get_scene_settings first to see the current shape, especially for spawnPoints and layout). Applies live in the editor, autosaves, and is undoable. Note: `thumbnail` is a resource the editor manages (leave it); changing `layout.parcels` reshapes the parcels the scene occupies.',
    inputSchema: {
      name: z.string().optional().describe('Scene display name'),
      description: z.string().optional().describe('Scene description'),
      categories: z
        .array(
          z.enum([
            'art',
            'game',
            'casino',
            'social',
            'music',
            'fashion',
            'crypto',
            'education',
            'shop',
            'business',
            'sports',
          ]),
        )
        .optional()
        .describe('Scene category tags'),
      ageRating: z.enum(['A']).optional().describe('Content age rating ("A" = adult)'),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      email: z.string().optional(),
      silenceVoiceChat: z.boolean().optional(),
      disableNearbyVoiceChat: z.boolean().optional(),
      disablePortableExperiences: z.boolean().optional(),
      hideLandscapeTerrain: z
        .boolean()
        .optional()
        .describe('Hide the surrounding Genesis City terrain'),
      skyboxConfig: z
        .object({
          fixedTime: z
            .number()
            .optional()
            .describe('Fixed time of day, in seconds since midnight (0–86400)'),
          transitionMode: z.number().optional().describe('0 = forward, 1 = backward'),
        })
        .optional(),
      layout: z
        .object({
          base: z.object({ x: z.number(), y: z.number() }),
          parcels: z.array(z.object({ x: z.number(), y: z.number() })),
        })
        .optional()
        .describe('The parcels the scene occupies (base + the full parcel list)'),
      spawnPoints: z
        .array(
          z.object({
            name: z.string(),
            default: z.boolean().optional().describe('The primary spawn point'),
            position: z
              .object({
                x: z.union([z.number(), z.array(z.number())]),
                y: z.union([z.number(), z.array(z.number())]),
                z: z.union([z.number(), z.array(z.number())]),
              })
              .describe('Each axis is a fixed number or a [min, max] range'),
            cameraTarget: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
          }),
        )
        .optional()
        .describe('Where avatars spawn'),
    },
  });

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
        const detail = entityDetail(await readComposite(currentProjectDir), entity);
        if (detail === null) return fail(`No entity found matching "${entity}".`);
        return ok(detail);
      } catch (e) {
        return fail(errMsg(e));
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
  registerSceneOpTool(server, 'create_entity', {
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
  });

  registerSceneOpTool(server, 'remove_entity', {
    title: 'Remove entity',
    description:
      'Delete an entity (and all its children) from the scene graph, by id. Live in the editor, autosaves, undoable. Use scene_state to find the id first.',
    inputSchema: { entity: z.number().describe('The entity id to remove') },
  });

  registerSceneOpTool(server, 'set_parent', {
    title: 'Set parent',
    description:
      'Reparent an entity under another (its world position is preserved). Use parent id 0 for the scene root. Live + undoable.',
    inputSchema: {
      entity: z.number().describe('The entity to reparent'),
      parent: z.number().describe('The new parent entity id (0 = scene root)'),
    },
  });

  registerSceneOpTool(server, 'set_component', {
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
  });

  registerSceneOpTool(server, 'remove_component', {
    title: 'Remove component',
    description:
      'Remove a component from an entity, by component name (e.g. "MeshRenderer"). Live + undoable.',
    inputSchema: {
      entity: z.number().describe('The entity id'),
      component: z.string().describe('Component name to remove'),
    },
  });

  registerSceneOpTool(server, 'search_catalog', {
    title: 'Search Smart Items catalog',
    description:
      'Search the Smart Items catalog (doors, buttons, platforms, NPCs, etc.) — pre-built items that carry their own behaviour. Returns matches with id, name, category, tags. Use before place_smart_item to get an assetId. Omit the query to list everything.',
    inputSchema: {
      query: z.string().optional().describe('Substring to match against name/category/tags/id'),
      limit: z.number().optional().describe('Max results (default 30)'),
    },
  });

  registerSceneOpTool(server, 'place_smart_item', {
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
  });

  registerSceneOpTool(server, 'attach_script', {
    title: 'Attach script',
    description:
      'Attach a script to an entity by adding an asset-packs::Script component pointing at a source file. WRITE THE SCRIPT FILE FIRST with your own file tools (put it under assets/Scripts/, e.g. assets/Scripts/Door.tsx), then call this with that path. Applies live, autosaves, undoable.',
    inputSchema: {
      entity: z.number().describe('The entity id to attach the script to'),
      path: z.string().describe('Path to the script file, e.g. "assets/Scripts/Door.tsx"'),
      priority: z.number().optional().describe('Execution priority (default 0)'),
    },
  });

  // ---- Explorer gateway (Phase 3): drive a running preview ----
  server.registerTool(
    'launch_preview',
    {
      title: 'Launch preview',
      description:
        'Launch the scene in the Decentraland preview (Explorer) with its runtime tools enabled, and connect to it. Use this to VERIFY your work in the running scene — see it, walk it, click things, read logs and performance. Returns whether the scene is ready and the catalog of runtime tools you can then call with explorer_call. The Explorer takes a while to boot and may need the user signed in; if it comes back not ready, wait and call preview_status (or explorer_call get_scene_state) again. When you are done verifying, leave the camera in third_person (explorer_call set_camera_mode) and call stop_preview if you launched it just to check.',
      inputSchema: {},
    },
    async () => {
      if (currentProjectDir === null) return fail('No scene is open.');
      try {
        return ok(await launchPreview(currentProjectDir));
      } catch (e) {
        return fail(`Failed to launch preview: ${errMsg(e)}`);
      }
    },
  );

  server.registerTool(
    'preview_status',
    {
      title: 'Preview status',
      description:
        'Check whether a preview is running and whether its scene has finished loading, plus the runtime tool catalog — without launching anything. Use this to poll for readiness after launch_preview.',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await previewStatus());
      } catch (e) {
        return fail(errMsg(e));
      }
    },
  );

  server.registerTool(
    'stop_preview',
    {
      title: 'Stop preview',
      description: 'Stop the running preview and disconnect from it. Call when done verifying.',
      inputSchema: {},
    },
    async () => {
      try {
        await stopPreview();
        return ok({ ok: true });
      } catch (e) {
        return fail(errMsg(e));
      }
    },
  );

  server.registerTool(
    'explorer_call',
    {
      title: 'Call an Explorer runtime tool',
      description:
        'Run one runtime tool inside the launched preview (screenshot, walk, move_to, look_at, set_camera_mode, click_entity, get_scene_state, get_scene_logs, get_player_state, list_scene_entities, get_entity_details, send_chat, trigger_emote, reload_scene, get_scene_content_stats, get_performance_stats, …). `tool` is the tool name and `arguments` its parameters — both come from the catalog returned by launch_preview. Requires a running preview (launch_preview first). Tips: poll get_scene_state until isReady before acting; read get_scene_logs with sinceSeq to page new logs; end verification with set_camera_mode third_person; screenshots are large, take them sparingly.',
      inputSchema: {
        tool: z.string().describe('The Explorer runtime tool name (from launch_preview catalog)'),
        arguments: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Arguments object for that tool (its schema is in the catalog)'),
      },
    },
    async ({ tool, arguments: args }) => {
      try {
        return formatExplorerResult(await callExplorerTool(tool, args ?? {}));
      } catch (e) {
        return fail(errMsg(e));
      }
    },
  );
}

// ---- Dynamic explorer_* tools ----
// While a preview is running the gateway exposes the Explorer's runtime tools; we register
// one first-class `explorer_<name>` tool per entry so the assistant gets typed, discoverable
// tools (not just the explorer_call passthrough, which stays as a fallback). They appear and
// disappear live via tools/list_changed as previews start and stop — which is why this server
// is stateful (a session to push the notification over).

// Minimal JSON-Schema → Zod raw-shape conversion for the Explorer's tool input schemas, which
// are flat objects of primitives. Unknown/unsupported shapes degrade to z.unknown() so the
// tool is still callable; the Explorer does the real validation.
// Convert one JSON-schema node to a Zod type, recursing into nested objects and array items so
// the advertised schema matches the Explorer's real shape (an object with `properties` becomes a
// nested z.object, not an opaque record). The Explorer still re-validates, so unknown shapes
// safely degrade to z.unknown().
function jsonSchemaToZod(node: unknown): ZodTypeAny {
  if (typeof node !== 'object' || node === null) return z.unknown();
  const n = node as { type?: string; description?: string; properties?: unknown; items?: unknown };
  let zt: ZodTypeAny;
  switch (n.type) {
    case 'string':
      zt = z.string();
      break;
    case 'number':
    case 'integer':
      zt = z.number();
      break;
    case 'boolean':
      zt = z.boolean();
      break;
    case 'array':
      zt = z.array(n.items !== undefined ? jsonSchemaToZod(n.items) : z.unknown());
      break;
    case 'object':
      zt =
        n.properties !== undefined
          ? z.object(jsonSchemaToZodShape(n))
          : z.record(z.string(), z.unknown());
      break;
    default:
      zt = z.unknown();
  }
  if (typeof n.description === 'string' && n.description !== '') zt = zt.describe(n.description);
  return zt;
}

function jsonSchemaToZodShape(schema: unknown): ZodRawShape {
  const shape: Record<string, ZodTypeAny> = {};
  if (typeof schema !== 'object' || schema === null) return shape;
  const s = schema as { properties?: Record<string, unknown>; required?: string[] };
  const required = new Set(s.required ?? []);
  for (const [key, prop] of Object.entries(s.properties ?? {})) {
    const zt = jsonSchemaToZod(prop);
    shape[key] = required.has(key) ? zt : zt.optional();
  }
  return shape;
}

function registerOneExplorerTool(server: McpServer, tool: ExplorerTool): RegisteredTool {
  return server.registerTool(
    `explorer_${tool.name}`,
    {
      title: tool.name,
      description: `${tool.description ?? `Explorer runtime tool "${tool.name}".`} (Runs in the launched preview; requires launch_preview.)`,
      inputSchema: jsonSchemaToZodShape(tool.inputSchema),
    },
    async (args: Record<string, unknown>) => {
      try {
        return formatExplorerResult(await callExplorerTool(tool.name, args ?? {}));
      } catch (e) {
        return fail(errMsg(e));
      }
    },
  );
}

// A live MCP session: its server, transport, and the explorer_* tool handles registered on
// it (so we can add/remove them and let McpServer push tools/list_changed).
interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  explorerHandles: Map<string, RegisteredTool>;
}
const sessions = new Map<string, Session>();

// Reconcile one session's explorer_* tools against the gateway's current tool set. Registering
// or removing a tool on a connected McpServer makes it emit tools/list_changed automatically.
function syncSessionExplorerTools(session: Session): void {
  const desired = new Map(explorerTools().map(t => [t.name, t]));
  for (const [name, handle] of session.explorerHandles) {
    if (!desired.has(name)) {
      handle.remove();
      session.explorerHandles.delete(name);
    }
  }
  for (const [name, tool] of desired) {
    if (!session.explorerHandles.has(name)) {
      session.explorerHandles.set(name, registerOneExplorerTool(session.server, tool));
    }
  }
}

function syncAllSessionsExplorerTools(): void {
  for (const session of sessions.values()) syncSessionExplorerTools(session);
}

let starting: Promise<SceneMcpInfo> | null = null;
let httpServer: http.Server | null = null;
let info: SceneMcpInfo | null = null;
let unsubscribeGatewayTools: (() => void) | null = null;
const AUTH_TOKEN = randomBytes(24).toString('hex');

// Build a fresh MCP server for a new session: the static tools plus whatever explorer_* tools
// the running preview currently exposes.
function buildSessionServer(): { server: McpServer; explorerHandles: Map<string, RegisteredTool> } {
  const server = new McpServer({ name: 'creator-hub', version: '1.0.0' });
  registerTools(server);
  const explorerHandles = new Map<string, RegisteredTool>();
  for (const tool of explorerTools()) {
    explorerHandles.set(tool.name, registerOneExplorerTool(server, tool));
  }
  return { server, explorerHandles };
}

// Thrown when a request body exceeds MAX_BODY_BYTES; the handler turns it into a 413.
class BodyTooLargeError extends Error {}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        reject(new BodyTooLargeError());
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (!done) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', err => {
      if (!done) reject(err);
    });
  });
}

// Start the MCP server once and return its localhost URL + token. Idempotent: repeat
// callers share the same in-flight/settled start.
export function ensureSceneMcpServer(): Promise<SceneMcpInfo> {
  if (info !== null) return Promise.resolve(info);
  if (starting !== null) return starting;

  starting = (async () => {
    // Keep every live session's explorer_* tools in sync as previews start/stop; each
    // McpServer emits tools/list_changed to its own client when its tool set changes.
    unsubscribeGatewayTools = onExplorerToolsChanged(() => syncAllSessionsExplorerTools());

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
        // Stateful streamable HTTP with one transport per session, routed by the
        // `Mcp-Session-Id` header. (The earlier "already initialized" failure was from
        // sharing ONE transport across requests — the correct fix is one per session, which
        // is also what lets the server push tools/list_changed so explorer_* tools can appear
        // and disappear live as previews start/stop.)
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        try {
          if (req.method === 'POST') {
            const raw = await readBody(req);
            const parsed = raw === '' ? undefined : JSON.parse(raw);
            const existing = sessionId ? sessions.get(sessionId) : undefined;
            if (existing !== undefined) {
              await existing.transport.handleRequest(req, res, parsed);
              return;
            }
            if (sessionId === undefined && isInitializeRequest(parsed)) {
              const { server, explorerHandles } = buildSessionServer();
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: sid => {
                  // Evict the oldest session if we're at the cap (Map preserves insertion
                  // order), so a client that never closes can't leak sessions forever.
                  if (sessions.size >= MAX_SESSIONS) {
                    const oldest = sessions.keys().next().value;
                    const stale = oldest !== undefined ? sessions.get(oldest) : undefined;
                    if (oldest !== undefined) sessions.delete(oldest);
                    void stale?.transport.close();
                    void stale?.server.close();
                  }
                  const session = { server, transport, explorerHandles };
                  sessions.set(sid, session);
                  // Reconcile against the latest tool set in case a preview started during init.
                  syncSessionExplorerTools(session);
                },
              });
              transport.onclose = () => {
                if (transport.sessionId !== undefined) sessions.delete(transport.sessionId);
                void server.close();
              };
              await server.connect(transport);
              await transport.handleRequest(req, res, parsed);
              return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'No valid session id, and not an initialize' },
                id: null,
              }),
            );
            return;
          }
          // GET opens the server→client SSE stream (used for tools/list_changed); DELETE ends
          // a session. Both must carry a known session id.
          if (req.method === 'GET' || req.method === 'DELETE') {
            const existing = sessionId ? sessions.get(sessionId) : undefined;
            if (existing === undefined) {
              res.writeHead(400, { 'Content-Type': 'application/json' }).end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32000, message: 'Missing or unknown session id' },
                  id: null,
                }),
              );
              return;
            }
            await existing.transport.handleRequest(req, res);
            return;
          }
          res.writeHead(405).end('Method not allowed');
        } catch (e) {
          if (e instanceof BodyTooLargeError) {
            if (!res.headersSent) res.writeHead(413).end('Request body too large');
            return;
          }
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
  unsubscribeGatewayTools?.();
  unsubscribeGatewayTools = null;
  for (const session of sessions.values()) {
    void session.transport.close();
    void session.server.close();
  }
  sessions.clear();
  httpServer?.close();
  httpServer = null;
  info = null;
  starting = null;
  // Remove the token-bearing config file (and its temp dir) so it doesn't linger in tmpdir,
  // and clear the path so a later start writes a fresh one.
  if (configPath !== null) {
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
    configPath = null;
  }
}

// Write the `--mcp-config` file the CLI reads: our server under the name `creator-hub`,
// as an HTTP MCP server with the bearer token. One file per app run, reused across turns.
let configPath: string | null = null;
export function writeSceneMcpConfigFile(mcp: SceneMcpInfo): string {
  if (configPath !== null) return configPath;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-hub-mcp-'));
  const file = path.join(dir, 'mcp-config.json');
  // The file holds the bearer token; write it owner-read/write only (the mkdtemp dir is
  // already 0700, but 0600 on the file is defense-in-depth on shared systems).
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
    { mode: 0o600 },
  );
  configPath = file;
  return file;
}
