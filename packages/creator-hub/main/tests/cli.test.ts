import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewOptions } from '/shared/types/settings';
import type { Child } from '../src/modules/bin';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  dclDeepLink: vi.fn(),
  install: vi.fn(),
  readFile: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/fake/exe') } }));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('fs/promises', () => ({ default: { readFile: mocks.readFile } }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/bin', () => ({ run: mocks.run, dclDeepLink: mocks.dclDeepLink }));
vi.mock('../src/modules/port', () => ({ getAvailablePort: vi.fn(async () => 4000) }));
vi.mock('../src/modules/window', () => ({
  getWindow: vi.fn(() => ({ isDestroyed: () => false, webContents: { send: mocks.send } })),
}));
vi.mock('../src/modules/analytics', () => ({
  getProjectId: vi.fn(async () => 'project-id'),
  track: vi.fn(),
}));
vi.mock('../src/modules/npm', () => ({ install: mocks.install }));
vi.mock('../src/modules/download-github-folder', () => ({ downloadGithubRepo: vi.fn() }));
vi.mock('../src/modules/mobile-debug-server', () => ({ startMobileDebugServer: vi.fn() }));
vi.mock('../src/modules/network', () => ({ getLanIp: vi.fn(() => '192.168.0.10') }));

import { cancelPreview, getPreview, start } from '../src/modules/cli';

const BASE_OPTS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: false,
  openNewInstance: false,
  multiInstance: false,
  showWarnings: false,
  optimizedAssets: false,
};

// Fake bin.Child whose deeplink print, failure and death the test controls.
function createFakeChild() {
  let alive = true;
  let settleWait!: () => void;
  const waitPromise = new Promise<Buffer>(resolve => {
    settleWait = () => resolve(Buffer.from(''));
  });
  let resolveWaitFor!: (logs: string) => void;
  const waitForPromise = new Promise<string>(resolve => {
    resolveWaitFor = resolve;
  });
  // start() awaits waitFor/wait through a race; an unconsumed rejection is fine
  waitPromise.catch(() => {});

  const child = {
    pkg: '@dcl/sdk-commands',
    bin: 'sdk-commands',
    args: [],
    cwd: '',
    process: {} as never,
    on: vi.fn(() => 1),
    once: vi.fn(() => 1),
    off: vi.fn(),
    wait: () => waitPromise,
    waitFor: vi.fn(() => waitForPromise),
    kill: vi.fn(async () => {
      alive = false;
      settleWait();
    }),
    alive: () => alive,
    stdall: () => [],
  } as unknown as Child;

  return {
    child,
    // the line sdk-commands prints once the preview is ready (the sdk also self-opens then)
    printDeeplink: (params: string) => resolveWaitFor(`Desktop client: decentraland://${params}`),
    // process death before any deeplink (crash, or an external kill)
    die: () => {
      alive = false;
      settleWait();
    },
  };
}

function setSceneSupportsAssetBundles(supported: boolean) {
  mocks.readFile.mockImplementation(async (file: unknown) => {
    if (String(file).includes('dist/commands/start/index.js')) {
      if (supported) return 'args spec with "--asset-bundles" flag';
      throw new Error('ENOENT');
    }
    // scene.json read (landscapeTerrain check): missing file keeps the default behavior
    throw new Error('ENOENT');
  });
}

function spawnedArgs(call = 0): string[] {
  return mocks.run.mock.calls[call][2].args;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

let sceneCount = 0;

describe('cli preview start', () => {
  let path: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // a unique path per test isolates the module-level preview cache between tests
    path = `/scenes/scene-${++sceneCount}`;
    setSceneSupportsAssetBundles(false);
    mocks.install.mockResolvedValue(undefined);
  });

  describe('when starting a fresh preview', () => {
    it('should not fire the deeplink itself (sdk-commands self-opens the client)', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, BASE_OPTS);
      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;

      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(mocks.dclDeepLink).not.toHaveBeenCalled();
    });

    it('should cache the captured deeplink for later re-focus', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, BASE_OPTS);
      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;

      expect(getPreview(path)?.url).toContain('realm=http');
    });

    describe('and optimized assets are enabled with a supporting sdk', () => {
      beforeEach(() => {
        setSceneSupportsAssetBundles(true);
      });

      it('should pass --asset-bundles and emit immediate progress so the ✕ shows right away', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
        fake.printDeeplink(
          'realm=http://127.0.0.1:8000&optimized-assets-url=http://127.0.0.1:9000',
        );
        await promise;

        expect(spawnedArgs()).toContain('--asset-bundles');
        expect(mocks.send).toHaveBeenCalledWith('preview.progress', {
          path,
          progress: { seconds: 0 },
        });
        expect(mocks.dclDeepLink).not.toHaveBeenCalled();
      });
    });

    describe('and optimized assets are enabled but the sdk lacks the sidecar', () => {
      it('should spawn without --asset-bundles and emit no conversion progress', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
        fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
        await promise;

        expect(spawnedArgs()).not.toContain('--asset-bundles');
        const progressPayloads = mocks.send.mock.calls
          .filter(([channel]) => channel === 'preview.progress')
          .map(([, payload]) => payload.progress);
        expect(progressPayloads.filter(Boolean)).toEqual([]);
      });
    });
  });

  describe('when a preview is already running', () => {
    let fake: ReturnType<typeof createFakeChild>;

    beforeEach(async () => {
      fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      const promise = start(path, BASE_OPTS);
      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;
      mocks.run.mockClear();
    });

    it('should re-focus the client by firing the adjusted deeplink instead of respawning', async () => {
      await start(path, BASE_OPTS);

      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.dclDeepLink).toHaveBeenCalledTimes(1);
    });

    describe('and the optimized-assets toggle now disagrees with the running preview', () => {
      beforeEach(() => {
        setSceneSupportsAssetBundles(true);
      });

      it('should kill the preview and respawn it with the sidecar', async () => {
        const restarted = createFakeChild();
        mocks.run.mockReturnValue(restarted.child);

        const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
        restarted.printDeeplink(
          'realm=http://127.0.0.1:8001&optimized-assets-url=http://127.0.0.1:9000',
        );
        await promise;

        expect(fake.child.kill).toHaveBeenCalled();
        expect(mocks.run).toHaveBeenCalledTimes(1);
        expect(spawnedArgs()).toContain('--asset-bundles');
      });
    });
  });

  describe('when a second start arrives while a spawn is still converting', () => {
    it('should ride the in-flight spawn instead of racing a second one', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const first = start(path, BASE_OPTS);
      await flush();
      const second = start(path, BASE_OPTS);
      await flush();

      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await Promise.all([first, second]);

      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(mocks.dclDeepLink).not.toHaveBeenCalled();
    });
  });

  describe('when the spawn dies before producing a deeplink', () => {
    it('should reinstall and retry once', async () => {
      const crashed = createFakeChild();
      const retried = createFakeChild();
      mocks.run
        .mockImplementationOnce(() => crashed.child)
        .mockImplementationOnce(() => retried.child);

      const promise = start(path, BASE_OPTS);
      await flush();
      crashed.die();
      await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
      retried.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;

      expect(mocks.install).toHaveBeenCalledTimes(1);
    });

    it('should reject when the retry dies too', async () => {
      const crashed = createFakeChild();
      const retried = createFakeChild();
      mocks.run
        .mockImplementationOnce(() => crashed.child)
        .mockImplementationOnce(() => retried.child);

      const promise = start(path, BASE_OPTS);
      await flush();
      crashed.die();
      await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
      retried.die();

      await expect(promise).rejects.toThrow('Preview process exited before producing a deeplink');
      expect(mocks.install).toHaveBeenCalledTimes(1);
    });
  });
});

describe('cli preview cancel', () => {
  let path: string;

  beforeEach(() => {
    vi.clearAllMocks();
    path = `/scenes/scene-${++sceneCount}`;
    setSceneSupportsAssetBundles(true);
    mocks.install.mockResolvedValue(undefined);
  });

  describe('when the preview is still converting (no deeplink yet)', () => {
    it('should kill the spawn and let start() settle quietly without a reinstall-retry', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
      await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));

      await cancelPreview(path);
      await expect(promise).resolves.toBe(path);

      expect(fake.child.kill).toHaveBeenCalled();
      expect(mocks.install).not.toHaveBeenCalled();
      expect(mocks.dclDeepLink).not.toHaveBeenCalled();
      expect(getPreview(path)).toBeUndefined();
    });
  });

  describe('when the preview has already opened', () => {
    it('should leave it alone', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, BASE_OPTS);
      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;

      await cancelPreview(path);

      expect(fake.child.kill).not.toHaveBeenCalled();
      expect(getPreview(path)?.url).toContain('realm=http');
    });
  });

  describe('when there is nothing running for the path', () => {
    it('should be a no-op', async () => {
      await expect(cancelPreview(path)).resolves.toBeUndefined();
    });
  });
});
