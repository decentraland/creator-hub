import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BEVY_REALM_EXIT_EVENT } from '/shared/types/ipc';

import type { Child } from '../src/modules/bin';

const mocks = vi.hoisted(() => ({
  child: undefined as unknown,
  send: vi.fn(),
}));

vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/bin', () => ({ run: vi.fn(() => mocks.child) }));
vi.mock('../src/modules/port', () => ({ getAvailablePort: vi.fn(async () => 8004) }));
vi.mock('../src/modules/analytics', () => ({
  getProjectId: vi.fn(async () => 'id'),
  track: vi.fn(),
}));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({ isDestroyed: () => false, webContents: { send: mocks.send } }),
}));

import { kill, killAllRealms, start } from '../src/modules/bevy-realm';
import { isRealmDown } from '../src/modules/realm-status';

type FakeChild = {
  child: Child;
  exit: () => void;
  crash: (err: Error) => void;
  release: () => void;
};

function createFakeChild(opts: { holdReady?: boolean } = {}): FakeChild {
  let alive = true;
  let resolveWait!: (buf: Buffer) => void;
  let rejectWait!: (err: Error) => void;
  const waitPromise = new Promise<Buffer>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });
  waitPromise.catch(() => {});
  let release: () => void = () => {};
  const ready = opts.holdReady
    ? new Promise<string>(resolve => {
        release = () => resolve('ready');
      })
    : Promise.resolve('ready');
  const exit = () => {
    alive = false;
    resolveWait(Buffer.from(''));
  };
  const child = {
    on: vi.fn(() => 1),
    once: vi.fn(() => 1),
    off: vi.fn(),
    wait: () => waitPromise,
    waitFor: vi.fn(() => ready),
    kill: vi.fn(async () => exit()),
    alive: () => alive,
    stdall: () => [],
  } as unknown as Child;
  return {
    child,
    exit,
    crash: err => {
      alive = false;
      rejectWait(err);
    },
    release: () => release(),
  };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function exitEvents() {
  return mocks.send.mock.calls.filter(([channel]) => channel === BEVY_REALM_EXIT_EVENT);
}

describe('bevy-realm supervision', () => {
  let path: string;
  let fake: FakeChild;

  beforeEach(() => {
    path = '/scenes/demo';
    fake = createFakeChild();
    mocks.child = fake.child;
  });

  afterEach(async () => {
    await killAllRealms();
    mocks.send.mockClear();
  });

  describe('when a running realm process exits on its own', () => {
    beforeEach(async () => {
      await start(path);
      fake.exit();
      await flush();
    });

    it('should mark the realm down', () => {
      expect(isRealmDown(path)).toBe(true);
    });

    it('should send one exit event with the path and a message to the main window', () => {
      expect(exitEvents()).toEqual([
        [BEVY_REALM_EXIT_EVENT, { path, message: expect.any(String) }],
      ]);
    });

    describe('and the editor starts it again', () => {
      let next: FakeChild;
      let restarting: Promise<unknown>;

      beforeEach(async () => {
        next = createFakeChild({ holdReady: true });
        mocks.child = next.child;
        restarting = start(path);
        await flush();
      });

      it('should keep the realm down until the new one is serving', async () => {
        expect(isRealmDown(path)).toBe(true);
        next.release();
        await restarting;
        expect(isRealmDown(path)).toBe(false);
      });
    });

    describe('and the user leaves it with kill', () => {
      beforeEach(async () => {
        await kill(path);
      });

      it('should clear the down state', () => {
        expect(isRealmDown(path)).toBe(false);
      });
    });

    describe('and the app quits', () => {
      beforeEach(async () => {
        await killAllRealms();
      });

      it('should clear the down state', () => {
        expect(isRealmDown(path)).toBe(false);
      });
    });
  });

  describe('when a running realm process fails with a non-zero exit code', () => {
    beforeEach(async () => {
      await start(path);
      fake.crash(new Error('exited with code=1'));
      await flush();
    });

    it('should mark the realm down', () => {
      expect(isRealmDown(path)).toBe(true);
    });

    it('should send the exit event with the failure in its message', () => {
      expect(exitEvents()).toEqual([
        [BEVY_REALM_EXIT_EVENT, { path, message: expect.stringContaining('code=1') }],
      ]);
    });
  });

  describe('when a running realm is killed deliberately', () => {
    beforeEach(async () => {
      await start(path);
      await kill(path);
      await flush();
    });

    it('should not mark the realm down', () => {
      expect(isRealmDown(path)).toBe(false);
    });

    it('should not send an exit event', () => {
      expect(exitEvents()).toEqual([]);
    });
  });

  describe('when a realm exits while the app is quitting', () => {
    beforeEach(async () => {
      const first = createFakeChild();
      const second = createFakeChild();
      vi.mocked(first.child.kill).mockImplementation(async () => {
        second.exit();
        await flush();
        first.exit();
      });
      mocks.child = first.child;
      await start('/scenes/one');
      mocks.child = second.child;
      await start('/scenes/two');
      await killAllRealms();
      await flush();
    });

    it('should not send an exit event', () => {
      expect(exitEvents()).toEqual([]);
    });
  });
});
