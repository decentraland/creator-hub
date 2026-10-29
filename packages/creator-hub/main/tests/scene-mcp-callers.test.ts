import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { AI_SCENE_OP_REQUEST } from '/shared/types/ipc';

// An editor window that runs every scene op it is sent, so mutations from the in-app assistant
// and from an outside agent land on one shared undo stack, as they do in the app.
const windowMock = vi.hoisted(() => ({
  ops: [] as string[],
  resolve: null as null | ((id: string, ok: boolean, payload: unknown) => void),
}));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, req: { id: string; op: string }) => {
        if (channel !== AI_SCENE_OP_REQUEST) return;
        windowMock.ops.push(req.op);
        queueMicrotask(() => windowMock.resolve?.(req.id, true, {}));
      },
    },
  }),
}));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/explorer-gateway', () => ({
  callExplorerTool: vi.fn(),
  explorerTools: () => [],
  onExplorerToolsChanged: () => () => {},
  gatewayProject: () => null,
  launchPreview: vi.fn(),
  previewStatus: vi.fn(),
  stopExplorerGateway: vi.fn(),
  stopPreview: vi.fn(),
}));

import {
  ensureSceneMcpServer,
  getExternalMcpInfo,
  getTurnMutations,
  resetTurnMutations,
  resolveSceneOp,
  revertTurn,
  setExternalMcpAccess,
  setSceneMcpProject,
  stopSceneMcpServer,
} from '../src/modules/scene-mcp';

windowMock.resolve = resolveSceneOp;

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

let projectDir: string;
let assistant: Client;
let outside: Client;

async function open(url: string, token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

const createEntity = (client: Client) =>
  client.callTool({ name: 'create_entity', arguments: { name: 'Box' } }) as Promise<ToolResult>;

beforeAll(async () => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-mcp-callers-'));
  const info = await ensureSceneMcpServer();
  setExternalMcpAccess(true);
  const external = (await getExternalMcpInfo())!;
  assistant = await open(info.url, info.token);
  outside = await open(external.url, external.token);
});

afterAll(async () => {
  await assistant.close();
  stopSceneMcpServer();
  fs.rmSync(projectDir, { recursive: true, force: true });
});

beforeEach(() => {
  setSceneMcpProject(projectDir);
  resetTurnMutations();
  windowMock.ops.length = 0;
});

describe('reverting an in-app turn', () => {
  describe('when only the assistant changed the scene', () => {
    it('should count its changes and undo exactly that many steps', async () => {
      await createEntity(assistant);
      await createEntity(assistant);
      windowMock.ops.length = 0;

      expect(await revertTurn(getTurnMutations())).toBe('reverted');

      expect(getTurnMutations()).toBe(2);
      expect(windowMock.ops).toEqual(['undo', 'undo']);
    });
  });

  describe('when an outside agent changed the scene during the turn', () => {
    it('should not count its change and refuse to undo anything', async () => {
      await createEntity(assistant);
      await createEntity(outside);
      windowMock.ops.length = 0;

      expect(await revertTurn(getTurnMutations())).toBe('blocked');

      expect(getTurnMutations()).toBe(1);
      expect(windowMock.ops).toEqual([]);
    });
  });
});

describe('a scene tool called with no scene open', () => {
  it('should fail at once without reaching the editor', async () => {
    setSceneMcpProject(null);

    const res = await createEntity(outside);

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('No scene is open.');
    expect(windowMock.ops).toEqual([]);
  });
});
