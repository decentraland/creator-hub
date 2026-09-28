import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PREVIEW_CLIENT, type PreviewOptions } from '/shared/types/settings';
import type { Child } from '../src/modules/bin';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  dclDeepLink: vi.fn(),
  install: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  send: vi.fn(),
  openExternal: vi.fn(),
  startMobileDebugServer: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/exe') },
  shell: { openExternal: mocks.openExternal },
}));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('fs/promises', () => ({ default: { readFile: mocks.readFile, stat: mocks.stat } }));
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
vi.mock('../src/modules/mobile-debug-server', () => ({
  startMobileDebugServer: mocks.startMobileDebugServer,
}));
vi.mock('../src/modules/network', () => ({ getLanIp: vi.fn(() => '192.168.0.10') }));

import {
  cancelPreview,
  getMobilePreview,
  getPreview,
  start,
  supportsAssetBundles,
} from '../src/modules/cli';

const BASE_OPTS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: false,
  openNewInstance: false,
  multiInstance: false,
  showWarnings: false,
  optimizedAssets: false,
  mcp: false,
  client: PREVIEW_CLIENT.DESKTOP,
};

// Fake bin.Child whose output, failure and death the test controls. Output is delivered
// per chunk like the real stdout stream: a waitFor() settles only on a chunk its pattern
// matches, so a test can reproduce sdk-commands printing two lines in separate chunks.
// Chunks printed before start() registers its waitFor (it awaits a scene.json read first)
// are replayed to it, as tests print the ready line right after calling start().
function createFakeChild() {
  let alive = true;
  let settleWait!: () => void;
  const waitPromise = new Promise<Buffer>(resolve => {
    settleWait = () => resolve(Buffer.from(''));
  });
  // start() awaits waitFor/wait through a race; an unconsumed rejection is fine
  waitPromise.catch(() => {});
  const printed: string[] = [];
  const pendingWaits: { pattern: RegExp; resolve: (chunk: string) => void }[] = [];
  const matches = (pattern: RegExp, chunk: string) => {
    pattern.lastIndex = 0;
    return pattern.test(chunk);
  };

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
    waitFor: vi.fn(
      (pattern: RegExp) =>
        new Promise<string>(resolve => {
          const earlier = printed.find(chunk => matches(pattern, chunk));
          if (earlier !== undefined) resolve(earlier);
          else pendingWaits.push({ pattern, resolve });
        }),
    ),
    kill: vi.fn(async () => {
      alive = false;
      settleWait();
    }),
    alive: () => alive,
    stdall: () => [...printed],
  } as unknown as Child;

  const print = (chunk: string) => {
    printed.push(chunk);
    for (const wait of pendingWaits.splice(0)) {
      if (matches(wait.pattern, chunk)) wait.resolve(chunk);
      else pendingWaits.push(wait);
    }
  };

  return {
    child,
    // one stdout chunk, as the real process would deliver it
    print,
    // the line sdk-commands prints once the preview is ready (the sdk also self-opens then)
    printDeeplink: (params: string) => print(`Desktop client: decentraland://${params}`),
    // process death before any deeplink (crash, or an external kill)
    die: () => {
      alive = false;
      settleWait();
    },
  };
}

const BEVY_WEB_URL =
  'https://decentraland.org/bevy-web/?preview=true&realm=http://127.0.0.1:8000&position=0,0';

// Drives a Bevy web start to its ready state the way sdk-commands prints it: the
// server-ready line and the browser URL arrive in separate stdout chunks.
async function startBevyWeb(path: string, fake: ReturnType<typeof createFakeChild>) {
  const promise = start(path, { ...BASE_OPTS, client: PREVIEW_CLIENT.BEVY_WEB });
  fake.print('Preview server is now running!\n');
  await flush();
  fake.print(`Available on:\n    ${BEVY_WEB_URL}\n`);
  await promise;
}

let fakeMtime = 0;

function setSceneSupportsAssetBundles(supported: boolean) {
  // a fresh mtime per stat keeps the support cache cold, so each call re-reads the file
  // and per-test support changes take effect immediately
  mocks.stat.mockImplementation(async (file: unknown) => {
    if (String(file).includes('dist/commands/start/index.js')) return { mtimeMs: ++fakeMtime };
    throw new Error('ENOENT');
  });
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

    it('should pass --mcp and the chosen --mcp-port (the Explorer gateway launch path)', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, { ...BASE_OPTS, mcp: true, mcpPort: 4321 });
      fake.printDeeplink('realm=http://127.0.0.1:8000&mcp=true');
      await promise;

      const args = spawnedArgs();
      expect(args).toContain('--mcp');
      expect(args.slice(args.indexOf('--mcp-port'), args.indexOf('--mcp-port') + 2)).toEqual([
        '--mcp-port',
        '4321',
      ]);
    });

    it('should not pass --mcp-port when no port is chosen', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, { ...BASE_OPTS, mcp: true });
      fake.printDeeplink('realm=http://127.0.0.1:8000&mcp=true');
      await promise;

      const args = spawnedArgs();
      expect(args).toContain('--mcp');
      expect(args).not.toContain('--mcp-port');
    });

    describe('and optimized assets are enabled with a supporting sdk', () => {
      beforeEach(() => {
        setSceneSupportsAssetBundles(true);
      });

      it('should pass --asset-bundles and emit immediate progress so the ✕ shows right away', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
        fake.printDeeplink('realm=http://127.0.0.1:8000&local-ab=true');
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

  describe('when starting a mobile-QR preview', () => {
    it('should spawn a bare `start --mobile`: it opens no client, so no client option applies', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      setSceneSupportsAssetBundles(true);

      const promise = start(path, {
        ...BASE_OPTS,
        mobile: true,
        enableLandscapeTerrains: true,
        multiInstance: true,
        mcp: true,
        mcpPort: 4321,
        optimizedAssets: true,
      });
      fake.printDeeplink('open?preview=http://192.168.0.10:8000&position=0,0');
      await promise;

      expect(spawnedArgs()).toEqual(['start', '--mobile']);
      // no sidecar means no "optimizing" progress either, only the final reset
      const progressPayloads = mocks.send.mock.calls
        .filter(([channel]) => channel === 'preview.progress')
        .map(([, payload]) => payload.progress);
      expect(progressPayloads.filter(Boolean)).toEqual([]);
    });

    it('should not pass --mobile for a regular desktop preview', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, BASE_OPTS);
      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await promise;

      expect(spawnedArgs()).not.toContain('--mobile');
    });

    describe('and the Bevy web client is the selected preview client', () => {
      it('should still take the --mobile path instead of opening the Bevy web tab', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, {
          ...BASE_OPTS,
          client: PREVIEW_CLIENT.BEVY_WEB,
          mobile: true,
        });
        fake.printDeeplink('open?preview=http://192.168.0.10:8000&position=0,0');
        await promise;

        expect(spawnedArgs()).toEqual(['start', '--mobile']);
        expect(mocks.openExternal).not.toHaveBeenCalled();
        expect(getPreview(path)?.url).toContain('open?preview=http://192.168.0.10:8000');
      });
    });

    describe('and a desktop preview is already running', () => {
      it('should reuse its server without restarting or re-firing the deeplink', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);
        const first = start(path, BASE_OPTS);
        fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
        await first;
        mocks.run.mockClear();

        await start(path, { ...BASE_OPTS, mobile: true });

        expect(fake.child.kill).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.dclDeepLink).not.toHaveBeenCalled();
        expect(getPreview(path)?.url).toContain('realm=http://127.0.0.1:8000');
      });
    });

    describe('and a Bevy web preview is already running', () => {
      it('should reuse its server without restarting or reopening the browser tab', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);
        await startBevyWeb(path, fake);
        mocks.run.mockClear();

        await start(path, { ...BASE_OPTS, client: PREVIEW_CLIENT.BEVY_WEB, mobile: true });

        expect(fake.child.kill).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.openExternal).not.toHaveBeenCalled();
      });
    });
  });

  describe('when starting a Bevy web preview', () => {
    it('should cache the browser URL sdk-commands prints after the server-ready line', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      await startBevyWeb(path, fake);

      expect(spawnedArgs()).toContain('--bevy-web');
      expect(getPreview(path)?.url).toBe(BEVY_WEB_URL);
    });

    it('should spawn a bare `start --bevy-web`: the preview options only parameterize the desktop client', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      setSceneSupportsAssetBundles(true);

      const promise = start(path, {
        ...BASE_OPTS,
        client: PREVIEW_CLIENT.BEVY_WEB,
        enableLandscapeTerrains: true,
        multiInstance: true,
        mcp: true,
        mcpPort: 4321,
        optimizedAssets: true,
      });
      fake.print(`Available on:\n    ${BEVY_WEB_URL}\n`);
      await promise;

      expect(spawnedArgs()).toEqual(['start', '--bevy-web']);
    });

    it('should not settle on the server-ready line alone', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      let settled = false;

      const promise = start(path, { ...BASE_OPTS, client: PREVIEW_CLIENT.BEVY_WEB }).then(() => {
        settled = true;
      });
      fake.print('Preview server is now running!\n');
      await flush();

      expect(settled).toBe(false);
      fake.print(`Available on:\n    ${BEVY_WEB_URL}\n`);
      await promise;
      expect(settled).toBe(true);
    });

    it('should reopen the cached browser URL on a repeat Preview press instead of respawning', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      await startBevyWeb(path, fake);
      mocks.run.mockClear();

      await start(path, { ...BASE_OPTS, client: PREVIEW_CLIENT.BEVY_WEB });

      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.openExternal).toHaveBeenCalledWith(BEVY_WEB_URL);
    });

    it('should reinstall and retry when the spawn dies before printing the URL', async () => {
      const crashed = createFakeChild();
      const retried = createFakeChild();
      mocks.run
        .mockImplementationOnce(() => crashed.child)
        .mockImplementationOnce(() => retried.child);

      const promise = start(path, { ...BASE_OPTS, client: PREVIEW_CLIENT.BEVY_WEB });
      await flush();
      crashed.die();
      await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
      retried.print(`Available on:\n    ${BEVY_WEB_URL}\n`);
      await promise;

      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(getPreview(path)?.url).toBe(BEVY_WEB_URL);
    });
  });

  describe('when a mobile-QR preview is already running and a desktop Preview is requested', () => {
    it('should restart instead of reusing so the desktop client actually opens', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      const first = start(path, { ...BASE_OPTS, mobile: true });
      fake.printDeeplink('open?preview=http://192.168.0.10:8000&position=0,0');
      await first;
      mocks.run.mockClear();

      const restarted = createFakeChild();
      mocks.run.mockReturnValue(restarted.child);
      const second = start(path, BASE_OPTS);
      restarted.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await second;

      expect(fake.child.kill).toHaveBeenCalled();
      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(spawnedArgs()).not.toContain('--mobile');
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
        restarted.printDeeplink('realm=http://127.0.0.1:8001&local-ab=true');
        await promise;

        expect(fake.child.kill).toHaveBeenCalled();
        expect(mocks.run).toHaveBeenCalledTimes(1);
        expect(spawnedArgs()).toContain('--asset-bundles');
      });
    });
  });

  describe('when a preview with the sidecar is already running', () => {
    let fake: ReturnType<typeof createFakeChild>;

    beforeEach(async () => {
      setSceneSupportsAssetBundles(true);
      fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      const promise = start(path, { ...BASE_OPTS, optimizedAssets: true });
      fake.printDeeplink('realm=http://127.0.0.1:8000&local-ab=true');
      await promise;
      mocks.run.mockClear();
    });

    it('should re-focus keeping local-ab when the toggle stays on', async () => {
      await start(path, { ...BASE_OPTS, optimizedAssets: true });

      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.dclDeepLink).toHaveBeenCalledTimes(1);
      const fired = mocks.dclDeepLink.mock.calls[0][0];
      expect(new URLSearchParams(fired).get('local-ab')).toBe('true');
    });

    it('should kill the preview and respawn it without the sidecar when the toggle goes off', async () => {
      const restarted = createFakeChild();
      mocks.run.mockReturnValue(restarted.child);

      const promise = start(path, BASE_OPTS);
      restarted.printDeeplink('realm=http://127.0.0.1:8001&position=0,0');
      await promise;

      expect(fake.child.kill).toHaveBeenCalled();
      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(spawnedArgs()).not.toContain('--asset-bundles');
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

    it('should serialize two starts issued in the same tick (registration happens before any await)', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      // no flush between them: both calls race the awaits inside start()
      const first = start(path, BASE_OPTS);
      const second = start(path, BASE_OPTS);

      fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await Promise.all([first, second]);

      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(mocks.dclDeepLink).not.toHaveBeenCalled();
    });
  });

  describe('when a second start arrives during the reinstall-retry', () => {
    it('should ride the whole operation instead of racing the retry spawn', async () => {
      const crashed = createFakeChild();
      const retried = createFakeChild();
      mocks.run
        .mockImplementationOnce(() => crashed.child)
        .mockImplementationOnce(() => retried.child);
      let resolveInstall!: () => void;
      mocks.install.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveInstall = resolve;
          }),
      );

      const first = start(path, BASE_OPTS);
      await flush();
      crashed.die();
      await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));

      // lands while the reinstall is still underway (no spawn alive at this moment)
      const second = start(path, BASE_OPTS);
      resolveInstall();
      await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
      retried.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
      await Promise.all([first, second]);

      // crashed spawn + its retry only: the second start never spawned a third process
      expect(mocks.run).toHaveBeenCalledTimes(2);
      expect(getPreview(path)?.url).toContain('realm=http');
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

describe('getMobilePreview', () => {
  let path: string;
  const fetchMock = vi.fn();
  const MOBILE_DEEPLINK = 'decentraland://open?preview=http://192.168.0.10:8000&position=0,0';

  beforeEach(() => {
    vi.clearAllMocks();
    path = `/scenes/scene-${++sceneCount}`;
    setSceneSupportsAssetBundles(false);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { url: MOBILE_DEEPLINK, qr: 'data:image/png;base64,qr' },
      }),
    });
    mocks.startMobileDebugServer.mockResolvedValue(9123);
  });

  it('should answer null when nothing is running for the path', async () => {
    expect(await getMobilePreview(path)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should ask the running Bevy web preview server for the QR (the URL carries the realm)', async () => {
    const fake = createFakeChild();
    mocks.run.mockReturnValue(fake.child);
    await startBevyWeb(path, fake);

    const result = await getMobilePreview(path);

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/mobile-preview');
    expect(result?.url).toContain('preview=http://192.168.0.10:8000');
    expect(result?.url).toContain('scene-inspector=');
    expect(result?.qr).toMatch(/^data:image\/png;base64,/);
  });

  it('should ask the running desktop preview server for the QR (the deeplink carries the realm)', async () => {
    const fake = createFakeChild();
    mocks.run.mockReturnValue(fake.child);
    const promise = start(path, BASE_OPTS);
    fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
    await promise;

    await getMobilePreview(path);

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/mobile-preview');
  });

  it('should ask the running mobile-QR preview server for the QR (the deeplink carries the LAN url)', async () => {
    const fake = createFakeChild();
    mocks.run.mockReturnValue(fake.child);
    const promise = start(path, { ...BASE_OPTS, mobile: true });
    fake.printDeeplink('open?preview=http://192.168.0.10:8000&position=0,0');
    await promise;

    await getMobilePreview(path);

    expect(fetchMock).toHaveBeenCalledWith('http://192.168.0.10:8000/mobile-preview');
  });

  it('should answer null when the server has no LAN address to hand the phone', async () => {
    const fake = createFakeChild();
    mocks.run.mockReturnValue(fake.child);
    await startBevyWeb(path, fake);
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ ok: false }) });

    expect(await getMobilePreview(path)).toBeNull();
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

describe('supportsAssetBundles', () => {
  let path: string;

  beforeEach(() => {
    vi.clearAllMocks();
    path = `/scenes/scene-${++sceneCount}`;
  });

  describe('when the sdk dist file has not changed', () => {
    it('should read the file once and answer later checks from the mtime cache', async () => {
      mocks.stat.mockResolvedValue({ mtimeMs: 1000 });
      mocks.readFile.mockResolvedValue('args spec with "--asset-bundles" flag');

      await expect(supportsAssetBundles(path)).resolves.toBe(true);
      await expect(supportsAssetBundles(path)).resolves.toBe(true);

      expect(mocks.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the sdk dist file changes (a reinstall or version bump)', () => {
    it('should re-read the file and pick up the new answer', async () => {
      mocks.stat.mockResolvedValue({ mtimeMs: 1000 });
      mocks.readFile.mockResolvedValue('args spec with "--asset-bundles" flag');
      await expect(supportsAssetBundles(path)).resolves.toBe(true);

      // downgraded to an sdk without the sidecar: new mtime, new content
      mocks.stat.mockResolvedValue({ mtimeMs: 2000 });
      mocks.readFile.mockResolvedValue('args spec without the flag');
      await expect(supportsAssetBundles(path)).resolves.toBe(false);

      expect(mocks.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the sdk is not installed', () => {
    it('should answer false without caching', async () => {
      mocks.stat.mockRejectedValue(new Error('ENOENT'));

      await expect(supportsAssetBundles(path)).resolves.toBe(false);

      // the sdk gets installed afterwards: the earlier miss must not stick
      mocks.stat.mockResolvedValue({ mtimeMs: 1000 });
      mocks.readFile.mockResolvedValue('args spec with "--asset-bundles" flag');
      await expect(supportsAssetBundles(path)).resolves.toBe(true);
    });
  });
});
