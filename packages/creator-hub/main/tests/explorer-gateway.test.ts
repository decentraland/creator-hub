import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fakes for the two external edges: the preview launcher (cli) and the MCP client SDK.
const mocks = vi.hoisted(() => {
  const client = {
    connect: vi.fn(async () => {}),
    listTools: vi.fn(async () => ({
      tools: [
        { name: 'get_scene_state', description: 'state', inputSchema: { type: 'object' } },
        { name: 'screenshot', description: 'shot', inputSchema: { type: 'object' } },
      ],
    })),
    callTool: vi.fn(async () => ({
      content: [{ type: 'text', text: JSON.stringify({ isReady: true, loadingScreenOn: false }) }],
    })),
    close: vi.fn(async () => {}),
  };
  return {
    client,
    transportClose: vi.fn(async () => {}),
    start: vi.fn(async () => 'scene'),
    killPreview: vi.fn(async () => {}),
    getPreview: vi.fn(() => ({ child: { alive: () => true } })),
    getAvailablePort: vi.fn(async () => 9999),
    readFile: vi.fn(async () => JSON.stringify({ version: '7.25.0' })),
  };
});

vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(() => mocks.client),
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(() => ({ close: mocks.transportClose })),
}));
vi.mock('../src/modules/cli', () => ({
  start: mocks.start,
  killPreview: mocks.killPreview,
  getPreview: mocks.getPreview,
}));
vi.mock('../src/modules/port', () => ({ getAvailablePort: mocks.getAvailablePort }));
vi.mock('fs/promises', () => ({ default: { readFile: mocks.readFile } }));

import {
  callExplorerTool,
  gatewayProject,
  launchPreview,
  previewStatus,
  stopPreview,
} from '../src/modules/explorer-gateway';

const PROJECT = '/home/user/scene';

beforeEach(async () => {
  await stopPreview(); // reset module state between tests
  vi.clearAllMocks();
  mocks.client.connect.mockResolvedValue(undefined);
  mocks.client.callTool.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({ isReady: true, loadingScreenOn: false }) }],
  });
  mocks.readFile.mockResolvedValue(JSON.stringify({ version: '7.25.0' }));
  mocks.getPreview.mockReturnValue({ child: { alive: () => true } });
});

describe('explorer gateway', () => {
  it('refuses to launch when the scene SDK is older than 7.25.0', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ version: '7.24.0' }));
    const res = await launchPreview(PROJECT);
    expect(res.running).toBe(false);
    expect(res.message).toMatch(/7\.25\.0/);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('launches with --mcp on a chosen port, connects, polls ready, and returns the catalog', async () => {
    const res = await launchPreview(PROJECT);
    expect(mocks.getAvailablePort).toHaveBeenCalled();
    // start() gets mcp:true and the chosen mcpPort
    expect(mocks.start).toHaveBeenCalledWith(
      PROJECT,
      expect.objectContaining({ mcp: true, mcpPort: 9999 }),
    );
    expect(mocks.client.connect).toHaveBeenCalled();
    expect(res.running).toBe(true);
    expect(res.ready).toBe(true);
    expect(res.port).toBe(9999);
    expect(res.tools.map(t => t.name)).toEqual(['get_scene_state', 'screenshot']);
  });

  it('proxies a tool call to the connected Explorer client', async () => {
    await launchPreview(PROJECT);
    mocks.client.callTool.mockResolvedValueOnce({ content: [{ type: 'text', text: 'walked' }] });
    const res = await callExplorerTool('walk', { directionY: 1, seconds: 1 });
    expect(mocks.client.callTool).toHaveBeenLastCalledWith(
      { name: 'walk', arguments: { directionY: 1, seconds: 1 } },
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(res.content).toEqual([{ type: 'text', text: 'walked' }]);
  });

  it('throws from a proxied call when no preview is running', async () => {
    await expect(callExplorerTool('walk', {})).rejects.toThrow(/launch_preview/);
  });

  it('tears down the client, transport, and preview on stop', async () => {
    await launchPreview(PROJECT);
    expect(gatewayProject()).toBe(PROJECT);
    await stopPreview();
    expect(mocks.client.close).toHaveBeenCalled();
    expect(mocks.transportClose).toHaveBeenCalled();
    expect(mocks.killPreview).toHaveBeenCalledWith(PROJECT);
    expect(gatewayProject()).toBeNull();
  });

  it('previewStatus reports nothing running before a launch', async () => {
    const res = await previewStatus();
    expect(res.running).toBe(false);
    expect(res.projectDir).toBeNull();
  });
});
