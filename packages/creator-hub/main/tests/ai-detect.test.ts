import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userData: '',
  spawnSync: vi.fn(() => ({ stdout: '', stderr: '' })),
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
  default: Object.assign(vi.fn(), { sync: mocks.spawnSync }),
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
