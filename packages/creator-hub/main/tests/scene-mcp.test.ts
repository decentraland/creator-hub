import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// scene-mcp pulls electron transitively (window + mainWindow, used only by the screenshot
// tool). Mock those so the module imports in the node test env; the read tools don't need
// a window.
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/window', () => ({ getWindow: () => undefined }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));

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
        'create_entity',
        'editor_screenshot',
        'entity_detail',
        'get_project_info',
        'scene_state',
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

  // The regression guard for the stateless fix: a second independent client must be able
  // to `initialize` too. A single shared stateful transport would reject it with
  // "Server already initialized".
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
});
