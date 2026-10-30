import fs from 'fs';
import os from 'os';
import path from 'path';

const mocks = vi.hoisted(() => ({
  userData: '',
  spawnSync: vi.fn(() => ({ stdout: '', stderr: '' })),
  spawn: vi.fn(),
}));

vi.mock('os', async importOriginal => {
  const real = await importOriginal<typeof os>();
  const homedir = () => '/nonexistent-home';
  return { ...real, homedir, default: { ...real, homedir } };
});

vi.mock('../src/modules/analytics', () => ({
  track: vi.fn(),
  getProjectId: vi.fn(async () => 'test-project-id'),
}));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({}),
  getChildEnv: () => ({ PATH: process.env.PATH }),
}));
vi.mock('cross-spawn', () => ({
  default: Object.assign(mocks.spawn, { sync: mocks.spawnSync }),
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

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiSend, detectProviders } from '../src/modules/ai';
import { getManagedBinDir } from '../src/modules/ai-cli-paths';

function writeBin(dir: string, name: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const bin = path.join(dir, name);
  fs.writeFileSync(bin, '#!/bin/sh\n');
  fs.chmodSync(bin, 0o755);
  return bin;
}

mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-detect-'));
const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-bin-'));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-project-'));
const originalPath = process.env.PATH;
const originalShell = process.env.SHELL;

beforeEach(() => {
  process.env.PATH = binDir;
  process.env.SHELL = '/usr/bin/true';
  fs.rmSync(path.join(mocks.userData, 'Claude'), { recursive: true, force: true });
});

afterAll(() => {
  process.env.PATH = originalPath;
  process.env.SHELL = originalShell;
  for (const dir of [binDir, project, mocks.userData]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('when Claude Desktop is installed', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(mocks.userData, 'Claude'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(path.join(binDir, 'claude'), { force: true });
  });

  it('should flag it while the Claude Code CLI is missing', async () => {
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude).toMatchObject({ available: false, desktopInstalled: true });
  });

  it('should not flag it once the Claude Code CLI is available', async () => {
    writeBin(binDir, 'claude');
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude).toMatchObject({ available: true, desktopInstalled: undefined });
  });
});

describe('when only a leftover app-managed Claude is installed', () => {
  it('should refuse the turn instead of running it', async () => {
    writeBin(getManagedBinDir(), 'claude');
    const claude = (await detectProviders()).find(p => p.id === 'claude');
    expect(claude?.available).toBe(false);
    await expect(aiSend({ provider: 'claude', text: 'hi' }, project, () => {})).rejects.toThrow(
      'Claude CLI not found',
    );
  });
});

describe('when an agent was just installed with its Windows installer', () => {
  const realPlatform = process.platform;
  const originalLocalAppData = process.env.LOCALAPPDATA;
  let localAppData: string;

  beforeEach(() => {
    localAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-localappdata-'));
    process.env.LOCALAPPDATA = localAppData;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mocks.spawnSync.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true });
    process.env.LOCALAPPDATA = originalLocalAppData;
    fs.rmSync(localAppData, { recursive: true, force: true });
  });

  it.each([
    ['codex', ['Programs', 'OpenAI', 'Codex', 'bin'], 'codex.exe'],
    ['cursor', ['cursor-agent'], 'cursor-agent.cmd'],
    ['claude', ['Microsoft', 'WinGet', 'Links'], 'claude.exe'],
  ])(
    'should find %s in the folder its installer added to PATH, without a restart',
    async (_id, dirs, name) => {
      const bin = writeBin(path.join(localAppData, ...dirs), name);
      await detectProviders();
      expect(mocks.spawnSync).toHaveBeenCalledWith(bin, ['--version'], expect.anything());
    },
  );
});

/** Make every spawned status command exit with `code` after printing `stdout`. */
function statusReplies(code: number, stdout: string) {
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    setTimeout(() => {
      child.stdout.end(stdout);
      child.emit('close', code);
    }, 0);
    return child;
  });
}

beforeEach(() => {
  statusReplies(0, 'Logged in using ChatGPT\n');
});

describe('when Codex is installed', () => {
  const apiKeyNames = ['OPENAI_API_KEY', 'CODEX_API_KEY'] as const;
  const originalKeys = apiKeyNames.map(name => process.env[name]);

  beforeEach(() => {
    for (const name of apiKeyNames) delete process.env[name];
    writeBin(binDir, 'codex');
  });

  afterEach(() => {
    apiKeyNames.forEach((name, i) => {
      if (originalKeys[i] === undefined) delete process.env[name];
      else process.env[name] = originalKeys[i];
    });
    fs.rmSync(path.join(binDir, 'codex'), { force: true });
    fs.rmSync(getManagedBinDir(), { recursive: true, force: true });
  });

  it('should not be available while Codex says it is not logged in', async () => {
    statusReplies(1, 'Not logged in\n');
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: false });
  });

  it('should be available once Codex says it is logged in', async () => {
    statusReplies(0, 'Logged in using ChatGPT\n');
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true });
  });

  it('should stay available when the status check gives no clear answer', async () => {
    statusReplies(2, "error: unrecognized subcommand 'status'\n");
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true });
  });

  it('should stay available when the status check cannot start', async () => {
    mocks.spawn.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true });
  });

  it.each(apiKeyNames)('should stay available when signed out but turns bill to %s', async name => {
    process.env[name] = 'sk-example123';
    statusReplies(1, 'Not logged in\n');
    const codex = (await detectProviders(true)).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true });
  });

  it('should not be available when an API key is set but turns bill to the subscription', async () => {
    process.env.OPENAI_API_KEY = 'sk-example123';
    statusReplies(1, 'Not logged in\n');
    const codex = (await detectProviders(false)).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: false });
  });

  it('should treat an app-installed Codex as signed in when Codex says so, without the marker', async () => {
    fs.rmSync(path.join(binDir, 'codex'), { force: true });
    writeBin(getManagedBinDir(), 'codex');
    statusReplies(0, 'Logged in using ChatGPT\n');
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: true, managedSignIn: true });
  });

  it('should re-ask Codex on every check', async () => {
    statusReplies(0, 'Logged in using ChatGPT\n');
    await detectProviders();
    statusReplies(1, 'Not logged in\n');
    const codex = (await detectProviders()).find(p => p.id === 'codex');
    expect(codex).toMatchObject({ available: false });
  });
});
