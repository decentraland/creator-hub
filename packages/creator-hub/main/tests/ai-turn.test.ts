import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  crossSpawn: vi.fn(),
  treeKill: vi.fn(),
}));

vi.mock('cross-spawn', () => ({ default: Object.assign(mocks.crossSpawn, { sync: vi.fn() }) }));
vi.mock('tree-kill', () => ({ default: mocks.treeKill }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('../src/modules/analytics', () => ({
  track: vi.fn(),
  getProjectId: vi.fn(async () => 'test-project-id'),
}));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({ binDir: '/bundle/bin' }),
  getChildEnv: () => ({ PATH: '/bundle/bin' }),
}));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => os.tmpdir() }));
vi.mock('../src/modules/skills', () => ({ ensureSkillsLinked: vi.fn(async () => {}) }));
vi.mock('../src/modules/scene-mcp', () => ({
  clearPendingAsks: vi.fn(),
  ensureSceneMcpServer: vi.fn(async () => {
    throw new Error('no MCP in tests');
  }),
  getTurnMutations: () => 0,
  resetTurnMutations: vi.fn(),
  setSceneMcpProject: vi.fn(),
  writeSceneMcpConfigFile: vi.fn(),
}));

import log from 'electron-log/main';
import { aiBusy, aiSend, aiStop } from '../src/modules/ai';

type FakeChild = EventEmitter & {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter & { end: () => void };
  kill: ReturnType<typeof vi.fn>;
};

function fakeChild(pid: number): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), { end: vi.fn() });
  child.kill = vi.fn();
  return child;
}

const send = (projectDir: string) =>
  aiSend({ provider: 'claude', text: 'hi', sessionId: 's1' }, projectDir, () => {});

describe('when running AI turns', () => {
  let projectDir: string;
  let binDir: string;
  let originalPath: string | undefined;
  let child: FakeChild;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-turn-project-'));
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-turn-bin-'));
    const name = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    fs.writeFileSync(path.join(binDir, name), '', { mode: 0o755 });
    originalPath = process.env.PATH;
    process.env.PATH = binDir;
    child = fakeChild(4242);
    mocks.crossSpawn.mockReturnValue(child);
  });

  afterEach(() => {
    aiStop();
    process.env.PATH = originalPath;
    vi.clearAllMocks();
  });

  describe('and a turn is still running', () => {
    beforeEach(async () => {
      await send(projectDir);
    });

    it('should refuse a second message instead of starting another CLI', async () => {
      await expect(send(projectDir)).rejects.toThrow(/still working/);
      expect(mocks.crossSpawn).toHaveBeenCalledTimes(1);
      expect(aiBusy()).toBe(true);
    });

    describe('and the CLI exits', () => {
      beforeEach(() => {
        child.emit('exit', 0, null);
      });

      it('should accept the next message', async () => {
        mocks.crossSpawn.mockReturnValue(fakeChild(4243));
        await expect(send(projectDir)).resolves.toEqual({ turnId: expect.any(String) });
      });

      it('should log that the turn ended, with its exit code', () => {
        expect(log.info).toHaveBeenCalledWith(expect.stringMatching(/turn t\d+ exited code=0/));
      });
    });
  });

  describe('and the user stops a turn on Windows', () => {
    let platform: PropertyDescriptor | undefined;

    beforeEach(async () => {
      await send(projectDir);
      platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32' });
      aiStop();
    });

    afterEach(() => {
      if (platform !== undefined) Object.defineProperty(process, 'platform', platform);
    });

    it('should kill the whole process tree, not just the cmd.exe wrapper', () => {
      expect(mocks.treeKill).toHaveBeenCalledWith(4242, 'SIGKILL');
      expect(child.kill).not.toHaveBeenCalled();
    });
  });
});
