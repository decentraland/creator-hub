import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userData: '', crossSpawn: vi.fn() }));

vi.mock('../src/modules/analytics', () => ({
  track: vi.fn(),
  getProjectId: vi.fn(async () => 'test-project-id'),
}));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({}),
  getChildEnv: () => ({
    PATH: process.env.PATH,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  }),
}));
vi.mock('cross-spawn', () => ({
  default: Object.assign(mocks.crossSpawn, { sync: () => ({ stdout: '', stderr: '' }) }),
}));
vi.mock('../src/modules/electron', () => ({
  getUserDataPath: () => mocks.userData,
  getAppDataPath: () => mocks.userData,
}));
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
vi.mock('../src/modules/scene-mcp', () => ({
  clearPendingAsks: vi.fn(),
  ensureSceneMcpServer: () => Promise.reject(new Error('no MCP in tests')),
  getTurnMutations: () => 0,
  resetTurnMutations: vi.fn(),
  setSceneMcpProject: vi.fn(),
  writeSceneMcpConfigFile: vi.fn(),
}));
vi.mock('../src/modules/skills', () => ({ ensureSkillsLinked: vi.fn(async () => {}) }));

import type { AiEvent, AiSendParams } from '/shared/types/ai';

import { aiSend, clearNeedsLogin, detectProviders } from '../src/modules/ai';

const SIGNED_OUT_LINES = [
  JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1' }),
  JSON.stringify({
    type: 'assistant',
    error: 'authentication_failed',
    is_api_error_message: true,
    message: { content: [{ type: 'text', text: 'Not logged in · Please run /login' }] },
  }),
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: true,
    result: 'Not logged in · Please run /login',
    session_id: 's1',
  }),
];

function fakeChild(lines: string[], code: number, stderr = '') {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: null,
    pid: undefined,
  });
  setTimeout(() => {
    child.stdout.write(lines.map(l => `${l}\n`).join(''));
    child.stderr.write(stderr);
    setTimeout(() => child.emit('exit', code, null), 5);
  }, 5);
  return child;
}

async function runTurn(
  lines: string[],
  code: number,
  { stderr = '', ...params }: Partial<AiSendParams> & { stderr?: string } = {},
): Promise<AiEvent[]> {
  mocks.crossSpawn.mockImplementationOnce(() => fakeChild(lines, code, stderr));
  const events: AiEvent[] = [];
  await new Promise<void>(resolve => {
    void aiSend({ provider: 'claude', text: 'hi', ...params }, project, e => {
      events.push(e);
      if (e.kind === 'done') resolve();
    });
  });
  return events;
}

function errorOf(events: AiEvent[]): string | undefined {
  const error = events.find(e => e.kind === 'error');
  return error?.kind === 'error' ? error.message : undefined;
}

mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-login-'));
const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-bin-'));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-project-'));
const originalPath = process.env.PATH;

afterAll(() => {
  process.env.PATH = originalPath;
  for (const dir of [binDir, project, mocks.userData]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('when an agent answers a turn by asking the user to sign in', () => {
  beforeEach(() => {
    for (const name of ['claude', 'codex', 'cursor-agent', 'gemini']) {
      const bin = path.join(binDir, name);
      fs.writeFileSync(bin, '#!/bin/sh\n');
      fs.chmodSync(bin, 0o755);
    }
    process.env.PATH = binDir;
  });

  it('should fail the turn with sign-in steps instead of the raw CLI line', async () => {
    const events = await runTurn(SIGNED_OUT_LINES, 1);
    expect(events.filter(e => e.kind === 'text')).toEqual([]);
    const error = events.find(e => e.kind === 'error');
    expect(error).toMatchObject({ kind: 'error' });
    expect(error?.kind === 'error' && error.message).toContain(
      'run `claude auth logout`, then `claude auth login`',
    );
    expect(error?.kind === 'error' && error.message).toContain(
      'Or set `ANTHROPIC_API_KEY` and turn on "Bill this to an API key instead" in Settings → AI.',
    );
    expect(events.find(e => e.kind === 'done')).toMatchObject({ ok: false });
  });

  it('should keep the agent available but flag it as needing sign-in', async () => {
    await runTurn(SIGNED_OUT_LINES, 1);
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude).toMatchObject({ available: true, needsLogin: true });
  });

  it('should clear the flag after the next successful turn', async () => {
    await runTurn(SIGNED_OUT_LINES, 1);
    await runTurn(
      [
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Hello!' }] },
        }),
      ],
      0,
    );
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude?.needsLogin).toBeUndefined();
  });

  it('should still fail the turn when the agent exits 0 after asking to sign in', async () => {
    const events = await runTurn(SIGNED_OUT_LINES, 0);
    expect(errorOf(events)).toContain('run `claude auth logout`, then `claude auth login`');
    expect(events.find(e => e.kind === 'done')).toMatchObject({ ok: false });
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude?.needsLogin).toBe(true);
  });

  it("should read Gemini's sign-in request from its error output", async () => {
    const events = await runTurn([], 41, {
      provider: 'gemini',
      stderr: 'Please set an Auth method in your settings.json or specify GEMINI_API_KEY\n',
    });
    expect(errorOf(events)).toContain('run `gemini`, then `/auth logout`, then `/auth login`');
  });

  it('should say the API key was rejected when the turn billed to one', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-example123';
    try {
      const events = await runTurn(SIGNED_OUT_LINES, 1, { apiKeyFromEnv: true });
      expect(errorOf(events)).toBe(
        'Claude rejected the API key in `ANTHROPIC_API_KEY`. Check the key, or turn off "Bill this to an API key instead" in Settings → AI to use your sign-in.',
      );
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('should clear the flag once the agent is signed in again from the app', async () => {
    await runTurn(SIGNED_OUT_LINES, 1);
    clearNeedsLogin('claude');
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude?.needsLogin).toBeUndefined();
  });
});

describe("when Codex comes from the user's own terminal install", () => {
  beforeEach(() => {
    const bin = path.join(binDir, 'codex');
    fs.writeFileSync(bin, '#!/bin/sh\n');
    fs.chmodSync(bin, 0o755);
    process.env.PATH = binDir;
  });

  it("should not offer in-app sign-in or sign-out, which only reach the app's own copy", async () => {
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true, managedSignIn: false });
  });
});
