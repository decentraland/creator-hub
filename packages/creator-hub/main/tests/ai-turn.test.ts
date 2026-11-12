import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  settings: {} as Record<string, unknown>,
  userData: '',
  crossSpawn: vi.fn(),
  treeKill: vi.fn(),
  ensureSceneMcpServer: vi.fn(),
  setSceneMcpProject: vi.fn(),
}));

vi.mock('cross-spawn', () => ({ default: Object.assign(mocks.crossSpawn, { sync: vi.fn() }) }));
vi.mock('tree-kill', () => ({ default: mocks.treeKill }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('../src/modules/analytics', () => ({
  track: vi.fn(),
  getProjectId: vi.fn(async () => 'test-project-id'),
  getUserId: () => mocks.userId,
}));
vi.mock('../src/modules/config', () => ({
  getConfigStorage: async () => ({ get: async () => mocks.settings }),
}));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({ binDir: '/bundle/bin' }),
  getChildEnv: () => ({ PATH: '/bundle/bin' }),
}));
vi.mock('../src/modules/electron', () => ({
  getUserDataPath: () => mocks.userData || os.tmpdir(),
  getAppVersion: async () => '9.9.9-test',
}));
vi.mock('../src/modules/skills', () => ({ ensureSkillsLinked: vi.fn(async () => {}) }));
vi.mock('../src/modules/scene-mcp', () => ({
  clearPendingAsks: vi.fn(),
  ensureSceneMcpServer: mocks.ensureSceneMcpServer,
  getTurnMutations: () => 0,
  resetTurnMutations: vi.fn(),
  setSceneMcpProject: mocks.setSceneMcpProject,
  writeSceneMcpConfigFile: vi.fn(),
}));

import log from 'electron-log/main';
import type { AiEvent, AiSendParams } from '/shared/types/ai';
import { AI_SHARING_CONSENT_VERSION, type AiTurnRecord } from '/shared/types/ai-sharing';
import { track } from '../src/modules/analytics';
import { setConversationShared, setSignedInWallet } from '../src/modules/ai-sharing';
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

const send = (projectDir: string, onEvent: (e: AiEvent) => void = () => {}) =>
  aiSend({ provider: 'claude', text: 'hi', sessionId: 's1' }, projectDir, onEvent);

const writeLines = (child: FakeChild, ...lines: object[]) =>
  child.stdout.emit('data', Buffer.from(lines.map(l => `${JSON.stringify(l)}\n`).join('')));

const exitAndClose = (child: FakeChild, code: number | null, signal: string | null = null) => {
  child.emit('exit', code, signal);
  child.emit('close', code, signal);
};

const assistantText = (text: string) => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
});

describe('when running AI turns', () => {
  let projectDir: string;
  let binDir: string;
  let originalPath: string | undefined;
  let child: FakeChild;
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    mocks.ensureSceneMcpServer.mockRejectedValue(new Error('no MCP in tests'));
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
    killSpy.mockRestore();
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
        exitAndClose(child, 0);
      });

      it('should accept the next message', async () => {
        mocks.crossSpawn.mockReturnValue(fakeChild(4243));
        await expect(send(projectDir)).resolves.toEqual({ turnId: expect.any(String) });
      });

      it('should log that the turn ended, with its exit code', () => {
        expect(log.info).toHaveBeenCalledWith(
          expect.stringMatching(/turn t-[0-9a-f-]+ exited code=0/),
        );
      });
    });
  });

  describe('and Claude writes its final result but keeps running a background task', () => {
    let events: AiEvent[];

    beforeEach(async () => {
      events = [];
      await send(projectDir, e => events.push(e));
      vi.useFakeTimers();
      writeLines(child, assistantText('STARTED'), {
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'cli-1',
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not end the turn while the CLI may still be exiting on its own', () => {
      expect(aiBusy()).toBe(true);
      expect(killSpy).not.toHaveBeenCalled();
    });

    describe('and the CLI is still running after the grace period', () => {
      beforeEach(() => {
        vi.advanceTimersByTime(10_000);
        exitAndClose(child, null, 'SIGKILL');
      });

      it('should kill the CLI process tree', () => {
        expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGKILL');
      });

      it('should end the turn as a successful reply, not an interruption', () => {
        expect(aiBusy()).toBe(false);
        expect(events).toContainEqual(expect.objectContaining({ kind: 'done', ok: true }));
        expect(events).not.toContainEqual(expect.objectContaining({ kind: 'error' }));
      });
    });
  });

  describe('and the app restarts between two turns', () => {
    let firstId: string;
    let secondId: string;

    const launchAndSend = async (pid: number) => {
      vi.resetModules();
      const launched = await import('../src/modules/ai');
      const spawned = fakeChild(pid);
      mocks.crossSpawn.mockReturnValue(spawned);
      const { turnId } = await launched.aiSend(
        { provider: 'claude', text: 'hi', sessionId: 's1' },
        projectDir,
        () => {},
      );
      exitAndClose(spawned, 0);
      return turnId;
    };

    beforeEach(async () => {
      firstId = await launchAndSend(4244);
      secondId = await launchAndSend(4245);
    });

    it('should not reuse a turn id that a saved transcript may already hold', () => {
      expect(secondId).not.toBe(firstId);
    });
  });

  describe('and the user stops a turn on Windows', () => {
    let platform: PropertyDescriptor | undefined;

    beforeEach(async () => {
      await send(projectDir);
      platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    afterEach(() => {
      if (platform !== undefined) Object.defineProperty(process, 'platform', platform);
    });

    describe('and taskkill succeeds', () => {
      beforeEach(() => {
        mocks.treeKill.mockImplementationOnce(
          (_pid: number, _signal: string, done: (e: Error | null) => void) => done(null),
        );
        aiStop();
      });

      it('should kill the whole process tree, not just the cmd.exe wrapper', () => {
        expect(mocks.treeKill).toHaveBeenCalledWith(4242, 'SIGKILL', expect.any(Function));
        expect(child.kill).not.toHaveBeenCalled();
      });
    });

    describe('and taskkill fails', () => {
      beforeEach(() => {
        mocks.treeKill.mockImplementationOnce(
          (_pid: number, _signal: string, done: (e?: Error) => void) =>
            done(new Error('Access is denied.')),
        );
        aiStop();
      });

      it('should fall back to killing the CLI it spawned', () => {
        expect(child.kill).toHaveBeenCalledWith('SIGKILL');
      });

      it('should log why the tree could not be killed', () => {
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Access is denied.'));
      });
    });
  });

  describe('and a message for another scene arrives while a turn runs', () => {
    let otherDir: string;

    beforeEach(async () => {
      mocks.ensureSceneMcpServer.mockResolvedValue({ url: 'http://127.0.0.1:1/mcp', token: 'x' });
      otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-turn-other-'));
      await send(projectDir);
      await send(otherDir).catch(() => {});
    });

    it("should keep the scene tools pointed at the running turn's scene", () => {
      expect(mocks.setSceneMcpProject).not.toHaveBeenCalledWith(otherDir);
    });
  });

  describe('and the CLI exits before its last output has been read', () => {
    let events: AiEvent[];

    beforeEach(async () => {
      events = [];
      await send(projectDir, e => events.push(e));
      child.emit('exit', 0, null);
      writeLines(child, assistantText('Done!'));
    });

    it('should still be waiting for the output', () => {
      expect(aiBusy()).toBe(true);
    });

    describe('and the output closes', () => {
      beforeEach(() => {
        child.emit('close', 0, null);
      });

      it('should end the turn with the late reply instead of reporting a silent turn', () => {
        expect(events).toContainEqual(expect.objectContaining({ kind: 'text', text: 'Done!' }));
        expect(events).toContainEqual(expect.objectContaining({ kind: 'done', ok: true }));
        expect(events).not.toContainEqual(expect.objectContaining({ kind: 'error' }));
      });
    });
  });

  describe('and a background task keeps the output open after the CLI exits', () => {
    let events: AiEvent[];

    beforeEach(async () => {
      events = [];
      await send(projectDir, e => events.push(e));
      vi.useFakeTimers();
      writeLines(child, assistantText('Started the server.'));
      child.emit('exit', 0, null);
      vi.advanceTimersByTime(5_000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should end the turn anyway', () => {
      expect(aiBusy()).toBe(false);
      expect(events).toContainEqual(expect.objectContaining({ kind: 'done', ok: true }));
    });
  });

  describe('and Claude reports a failed result but keeps running', () => {
    let events: AiEvent[];

    beforeEach(async () => {
      events = [];
      await send(projectDir, e => events.push(e));
      vi.useFakeTimers();
      writeLines(child, assistantText('Reached the turn limit.'), {
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        session_id: 'cli-1',
      });
      vi.advanceTimersByTime(10_000);
      exitAndClose(child, null, 'SIGKILL');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should end the turn as a failure', () => {
      expect(events).toContainEqual(expect.objectContaining({ kind: 'done', ok: false }));
    });
  });

  describe('and the user stops a turn', () => {
    let events: AiEvent[];

    beforeEach(async () => {
      events = [];
      await send(projectDir, e => events.push(e));
      aiStop();
    });

    it('should end it with a cancelled done event', () => {
      expect(events).toContainEqual(
        expect.objectContaining({ kind: 'done', ok: false, cancelled: true }),
      );
    });

    it('should report it to analytics as cancelled', async () => {
      await vi.waitFor(() =>
        expect(track).toHaveBeenCalledWith(
          'AI Turn Completed',
          expect.objectContaining({ ok: false, cancelled: true }),
        ),
      );
    });

    it('should not end the turn a second time when the CLI then exits', () => {
      exitAndClose(child, null, 'SIGKILL');

      expect(events.filter(e => e.kind === 'done')).toHaveLength(1);
    });
  });

  describe('and the CLI reports its model and token usage', () => {
    beforeEach(async () => {
      await send(projectDir);
      writeLines(
        child,
        { type: 'system', subtype: 'init', model: 'claude-sonnet-example', session_id: 'cli-1' },
        assistantText('Done.'),
        { type: 'result', usage: { input_tokens: 10, output_tokens: 3 }, session_id: 'cli-1' },
      );
      exitAndClose(child, 0);
    });

    it('should pass them to analytics', async () => {
      await vi.waitFor(() =>
        expect(track).toHaveBeenCalledWith(
          'AI Turn Completed',
          expect.objectContaining({
            actual_model: 'claude-sonnet-example',
            input_tokens: 10,
            output_tokens: 3,
            cancelled: false,
          }),
        ),
      );
    });
  });

  describe('and sharing is involved', () => {
    const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
    const grant = { consent: 'granted', version: AI_SHARING_CONSENT_VERSION, decidedAt: 'x' };
    const settle = () => new Promise(r => setTimeout(r, 0));
    const shared: AiSendParams = {
      provider: 'claude',
      text: 'add a door, key sk-ant-api03-exampleexampleexample00',
      sessionId: 's1',
      share: { wallet: ADDRESS, turnIndex: 0, selectedEntityCount: 1, mentionedAssetCount: 0 },
    };
    const outboxDir = () => path.join(mocks.userData, 'ai-sharing', 'outbox');
    const queued = (): AiTurnRecord[] =>
      fs.existsSync(outboxDir())
        ? fs
            .readdirSync(outboxDir())
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(outboxDir(), f), 'utf8')))
        : [];
    const runTurn = async (params: AiSendParams) => {
      await aiSend(params, projectDir, () => {});
      writeLines(child, assistantText('Added it.'));
      exitAndClose(child, 0);
      await new Promise(r => setTimeout(r, 0));
    };

    // One folder for the whole block: main resolves the outbox path once and keeps it.
    beforeAll(() => {
      mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sharing-userdata-'));
    });

    afterAll(() => {
      fs.rmSync(mocks.userData, { recursive: true, force: true });
      mocks.userData = '';
    });

    beforeEach(() => {
      setSignedInWallet(ADDRESS);
      mocks.settings = { aiDataSharing: { [ADDRESS]: grant } };
    });

    afterEach(() => {
      fs.rmSync(outboxDir(), { recursive: true, force: true });
      setSignedInWallet(null);
      mocks.settings = {};
    });

    it('should queue one redacted record when the user consented and is signed in', async () => {
      await runTurn(shared);

      const records = queued();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        address: ADDRESS,
        outcome: 'ok',
        prompt: { text: 'add a door, key <api_key>' },
        response: { text: 'Added it.' },
        app: { version: '9.9.9-test' },
      });
    });

    it('should record nothing when the renderer did not ask to share', async () => {
      await runTurn({ ...shared, share: undefined });

      expect(queued()).toEqual([]);
    });

    it('should record nothing without saved consent, even if the renderer asks', async () => {
      mocks.settings = {};
      await runTurn(shared);

      expect(queued()).toEqual([]);
    });

    it('should record nothing for consent given to an older version of the text', async () => {
      mocks.settings = {
        aiDataSharing: { [ADDRESS]: { ...grant, version: AI_SHARING_CONSENT_VERSION - 1 } },
      };
      await runTurn(shared);

      expect(queued()).toEqual([]);
    });

    it('should record nothing for a wallet that never agreed, though another did here', async () => {
      const other = '0x000000000000000000000000000000000000beef';
      setSignedInWallet(other);
      await runTurn({ ...shared, share: { ...shared.share!, wallet: other } });

      expect(queued()).toEqual([]);
    });

    it('should record nothing when the creator withdraws while the turn runs', async () => {
      await aiSend(shared, projectDir, () => {});
      mocks.settings = { aiDataSharing: { [ADDRESS]: { ...grant, consent: 'denied' } } };
      writeLines(child, assistantText('Added it.'));
      exitAndClose(child, 0);
      await settle();

      expect(queued()).toEqual([]);
    });

    it('should record nothing when the wallet changes while the turn runs', async () => {
      await aiSend(shared, projectDir, () => {});
      setSignedInWallet('0x000000000000000000000000000000000000beef');
      writeLines(child, assistantText('Added it.'));
      exitAndClose(child, 0);
      await settle();

      expect(queued()).toEqual([]);
    });

    it('should record nothing when the conversation is excluded while the turn runs', async () => {
      await aiSend(shared, projectDir, () => {});
      setConversationShared('s1', false);
      writeLines(child, assistantText('Added it.'));
      exitAndClose(child, 0);
      await settle();
      setConversationShared('s1', true);

      expect(queued()).toEqual([]);
    });

    it('should record nothing when the renderer asks for a wallet that is not signed in', async () => {
      setSignedInWallet('0x000000000000000000000000000000000000beef');
      await runTurn(shared);

      expect(queued()).toEqual([]);
    });

    it('should record nothing when signed out', async () => {
      setSignedInWallet(null);
      await runTurn(shared);

      expect(queued()).toEqual([]);
    });

    it('should record a stopped turn as cancelled', async () => {
      const events: AiEvent[] = [];
      await aiSend(shared, projectDir, e => events.push(e));
      aiStop();
      await settle();

      expect(events).toContainEqual(expect.objectContaining({ kind: 'done', cancelled: true }));

      expect(queued()).toEqual([
        expect.objectContaining({ outcome: 'cancelled', errorKind: null }),
      ]);
    });
  });
});
