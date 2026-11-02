import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

// scene-mcp pulls electron transitively (window + mainWindow, used only by the screenshot
// tool). Mock those so the module imports in the node test env; the read tools don't need
// a window.
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/window', () => ({ getWindow: () => undefined }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
// The Explorer gateway pulls in cli → bin/path (electron `app` at import); the read/mutation
// tools under test don't touch it, so stub it out. gatewayProject() must return null so
// setSceneMcpProject doesn't try to tear a gateway down. `explorerTools`/`onExplorerToolsChanged`
// are made controllable so a test can drive the dynamic explorer_* registration + list_changed.
const gatewayMock = vi.hoisted(() => {
  let tools: Array<{ name: string; description?: string; inputSchema?: unknown }> = [];
  const listeners = new Set<() => void>();
  return {
    setTools(next: typeof tools) {
      tools = next;
      for (const cb of listeners) cb();
    },
    explorerTools: () => tools,
    onExplorerToolsChanged: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    callExplorerTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] })),
  };
});
vi.mock('../src/modules/explorer-gateway', () => ({
  callExplorerTool: gatewayMock.callExplorerTool,
  explorerTools: gatewayMock.explorerTools,
  onExplorerToolsChanged: gatewayMock.onExplorerToolsChanged,
  gatewayProject: () => null,
  launchPreview: vi.fn(),
  previewStatus: vi.fn(),
  stopExplorerGateway: vi.fn(),
  stopPreview: vi.fn(),
}));

import {
  ensureSceneMcpServer,
  setSceneMcpProject,
  stopSceneMcpServer,
  type SceneMcpInfo,
} from '../src/modules/scene-mcp';

const composite = {
  version: 1,
  components: [
    {
      name: 'core-schema::Name',
      data: { '512': { json: { value: 'Front Door' } }, '513': { json: { value: 'Cube' } } },
    },
    { name: 'core::Transform', data: { '512': { json: { position: { x: 8, y: 1.5, z: 10 } } } } },
    { name: 'asset-packs::Triggers', data: { '512': { json: { value: [] } } } },
  ],
};

let info: SceneMcpInfo;
let projectDir: string;

async function open(token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(info.url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

beforeAll(async () => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-mcp-'));
  fs.mkdirSync(path.join(projectDir, 'assets', 'scene'), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'assets', 'scene', 'main.composite'),
    JSON.stringify(composite),
  );
  fs.writeFileSync(
    path.join(projectDir, 'scene.json'),
    JSON.stringify({ display: { title: 'Test Scene' }, scene: { parcels: ['0,0'], base: '0,0' } }),
  );
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'test', dependencies: {} }),
  );
  setSceneMcpProject(projectDir);
  info = await ensureSceneMcpServer();
});

afterAll(() => {
  stopSceneMcpServer();
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('scene-mcp server', () => {
  it('exposes the read-only tools to a connected client', async () => {
    const client = await open(info.token);
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(
      [
        'ask_user',
        'attach_script',
        'create_entity',
        'editor_screenshot',
        'entity_detail',
        'explorer_call',
        'get_project_info',
        'get_scene_metrics',
        'get_scene_settings',
        'get_selection',
        'launch_preview',
        'place_smart_item',
        'preview_status',
        'remove_component',
        'remove_entity',
        'scene_state',
        'search_catalog',
        'set_component',
        'set_parent',
        'set_scene_settings',
        'stop_preview',
      ].sort(),
    );
    await client.close();
  });

  it('returns the real scene roster from scene_state', async () => {
    const client = await open(info.token);
    const res = (await client.callTool({ name: 'scene_state', arguments: {} })) as {
      content: { type: string; text: string }[];
    };
    const payload = JSON.parse(res.content[0].text);
    expect(payload.total).toBe(2);
    expect(payload.entities.map((e: { name: string }) => e.name).sort()).toEqual([
      'Cube',
      'Front Door',
    ]);
    await client.close();
  });

  it('resolves entity_detail by name (zod string arg over the wire)', async () => {
    const client = await open(info.token);
    const res = (await client.callTool({
      name: 'entity_detail',
      arguments: { entity: 'front door' },
    })) as {
      content: { type: string; text: string }[];
    };
    const payload = JSON.parse(res.content[0].text);
    expect(payload.id).toBe(512);
    await client.close();
  });

  // Regression guard for the session-routing fix: a second independent client must be able
  // to `initialize` too. The original bug shared ONE transport across requests, so the
  // second initialize was rejected with "Server already initialized"; per-session transports
  // fix it (and are what lets the server push tools/list_changed).
  it('accepts a second, independent client connection', async () => {
    const a = await open(info.token);
    const b = await open(info.token);
    expect((await b.listTools()).tools.length).toBeGreaterThan(0);
    await a.close();
    await b.close();
  });

  it('rejects a wrong bearer token', async () => {
    await expect(open('not-the-token')).rejects.toBeTruthy();
  });

  // Dynamic explorer_* tools: when a preview connects/disconnects, the gateway's tool set
  // changes and each live session must gain/lose the matching explorer_<name> tools and be
  // told via tools/list_changed.
  it('registers and removes explorer_* tools live and notifies the client', async () => {
    gatewayMock.setTools([]); // start with no preview
    const client = await open(info.token);
    let changed = 0;
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      changed++;
    });

    const before = (await client.listTools()).tools.map(t => t.name);
    expect(before).not.toContain('explorer_walk');

    // a preview connects, exposing a `walk` tool
    gatewayMock.setTools([
      {
        name: 'walk',
        description: 'Walk the avatar',
        inputSchema: { type: 'object', properties: { seconds: { type: 'number' } } },
      },
    ]);
    await vi.waitFor(async () => {
      const names = (await client.listTools()).tools.map(t => t.name);
      expect(names).toContain('explorer_walk');
    });

    // the preview stops
    gatewayMock.setTools([]);
    await vi.waitFor(async () => {
      const names = (await client.listTools()).tools.map(t => t.name);
      expect(names).not.toContain('explorer_walk');
    });

    await vi.waitFor(() => expect(changed).toBeGreaterThan(0)); // list_changed was pushed
    await client.close();
  });
});
