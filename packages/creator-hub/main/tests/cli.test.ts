import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PREVIEW_CLIENT, type PreviewOptions } from '/shared/types/settings';
import type { Child } from '../src/modules/bin';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  dclDeepLink: vi.fn(),
  install: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  openExternal: vi.fn(),
  startMobileDebugServer: vi.fn(),
  dynamicImport: vi.fn(),
  runSdkCommand: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/exe') },
  shell: { openExternal: mocks.openExternal },
}));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('fs/promises', () => ({ default: { readFile: mocks.readFile, stat: mocks.stat } }));
vi.mock('../src/modules/bin', () => ({ run: mocks.run, dclDeepLink: mocks.dclDeepLink }));
vi.mock('../src/modules/port', () => ({ getAvailablePort: vi.fn(async () => 4000) }));
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
vi.mock('/shared/dynamic-import', () => ({ dynamicImport: mocks.dynamicImport }));

import {
  getMobilePreview,
  getPreview,
  start,
  getDeployCommandSupport,
  type DeployCommandSupport,
  deploy,
} from '../src/modules/cli';

const BASE_OPTS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: false,
  openNewInstance: false,
  multiInstance: false,
  showWarnings: false,
  loadRawGltfs: false,
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

function setSceneJsonMissing() {
  // missing scene.json keeps the default landscapeTerrain behavior
  mocks.readFile.mockRejectedValue(new Error('ENOENT'));
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
    setSceneJsonMissing();
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

    describe('and raw GLTFs are requested', () => {
      it('should end the args with the explorer passthrough for lsd-raw-gltf', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, { ...BASE_OPTS, loadRawGltfs: true, mcp: true, mcpPort: 4321 });
        fake.printDeeplink('realm=http://127.0.0.1:8000&lsd-raw-gltf=true');
        await promise;

        expect(spawnedArgs().slice(-2)).toEqual(['--', '--lsd-raw-gltf']);
      });
    });

    describe('and raw GLTFs are not requested', () => {
      it('should not pass the explorer passthrough at all', async () => {
        const fake = createFakeChild();
        mocks.run.mockReturnValue(fake.child);

        const promise = start(path, BASE_OPTS);
        fake.printDeeplink('realm=http://127.0.0.1:8000&position=0,0');
        await promise;

        expect(spawnedArgs()).not.toContain('--');
        expect(spawnedArgs()).not.toContain('--lsd-raw-gltf');
      });
    });
  });

  describe('when starting a mobile-QR preview', () => {
    it('should spawn a bare `start --mobile`: it opens no client, so no client option applies', async () => {
      const fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);

      const promise = start(path, {
        ...BASE_OPTS,
        mobile: true,
        enableLandscapeTerrains: true,
        multiInstance: true,
        mcp: true,
        mcpPort: 4321,
        loadRawGltfs: true,
      });
      fake.printDeeplink('open?preview=http://192.168.0.10:8000&position=0,0');
      await promise;

      expect(spawnedArgs()).toEqual(['start', '--mobile']);
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

      const promise = start(path, {
        ...BASE_OPTS,
        client: PREVIEW_CLIENT.BEVY_WEB,
        enableLandscapeTerrains: true,
        multiInstance: true,
        mcp: true,
        mcpPort: 4321,
        loadRawGltfs: true,
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

    it('should leave lsd-raw-gltf out of the re-focus deeplink', async () => {
      await start(path, BASE_OPTS);

      const fired = mocks.dclDeepLink.mock.calls[0][0];
      expect(new URLSearchParams(fired).has('lsd-raw-gltf')).toBe(false);
    });

    describe('and raw GLTFs are now requested', () => {
      it('should kill the preview and respawn it with the passthrough (the explorer reads it only at startup)', async () => {
        const restarted = createFakeChild();
        mocks.run.mockReturnValue(restarted.child);

        const promise = start(path, { ...BASE_OPTS, loadRawGltfs: true });
        restarted.printDeeplink('realm=http://127.0.0.1:8001&lsd-raw-gltf=true');
        await promise;

        expect(fake.child.kill).toHaveBeenCalled();
        expect(mocks.run).toHaveBeenCalledTimes(1);
        expect(mocks.dclDeepLink).not.toHaveBeenCalled();
        expect(spawnedArgs().slice(-2)).toEqual(['--', '--lsd-raw-gltf']);
      });
    });
  });

  describe('when a preview loading raw GLTFs is already running', () => {
    let fake: ReturnType<typeof createFakeChild>;

    beforeEach(async () => {
      fake = createFakeChild();
      mocks.run.mockReturnValue(fake.child);
      const promise = start(path, { ...BASE_OPTS, loadRawGltfs: true });
      fake.printDeeplink('realm=http://127.0.0.1:8000&lsd-raw-gltf=true');
      await promise;
      mocks.run.mockClear();
    });

    it('should re-focus keeping lsd-raw-gltf when the setting stays on', async () => {
      await start(path, { ...BASE_OPTS, loadRawGltfs: true });

      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.dclDeepLink).toHaveBeenCalledTimes(1);
      const fired = mocks.dclDeepLink.mock.calls[0][0];
      expect(new URLSearchParams(fired).get('lsd-raw-gltf')).toBe('true');
    });

    it('should kill the preview and respawn it without the passthrough when the setting goes off', async () => {
      const restarted = createFakeChild();
      mocks.run.mockReturnValue(restarted.child);

      const promise = start(path, BASE_OPTS);
      restarted.printDeeplink('realm=http://127.0.0.1:8001&position=0,0');
      await promise;

      expect(fake.child.kill).toHaveBeenCalled();
      expect(mocks.run).toHaveBeenCalledTimes(1);
      expect(spawnedArgs()).not.toContain('--lsd-raw-gltf');
    });
  });

  describe('when a second start arrives while a spawn is still booting', () => {
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
    setSceneJsonMissing();
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

describe('getDeployCommandSupport', () => {
  let files: Record<string, string>;
  let result: DeployCommandSupport;

  beforeEach(() => {
    vi.clearAllMocks();
    files = {};
    const find = (file: string) => {
      const name = Object.keys(files).find(suffix => file.endsWith(suffix));
      if (name === undefined) throw new Error('ENOENT');
      return name;
    };
    mocks.readFile.mockImplementation(async (file: string) => files[find(file)]);
    mocks.stat.mockImplementation(async (file: string) => {
      find(file);
      return { mtimeMs: 1 };
    });
  });

  const read = async () => {
    result = await getDeployCommandSupport(`/scenes/scene-${++sceneCount}`);
  };

  describe('when the deploy command predates programmatic deploys', () => {
    beforeEach(async () => {
      files['deploy/index.js'] = 'deploy command';
      await read();
    });

    it('should report it as legacy, without any newer capability', () => {
      expect(result).toEqual({
        legacy: true,
        multiScene: false,
        deployResource: false,
        deployToken: false,
      });
    });
  });

  describe('when the deploy command ships its routes module and declares every flag', () => {
    beforeEach(async () => {
      files['deploy/index.js'] =
        "const args = { '--programmatic': Boolean, '--multi-scene': Boolean, '--deploy-token': String }";
      files['deploy/routes.js'] = "router.delete('/api/deploy')";
      await read();
    });

    it('should report every capability', () => {
      expect(result).toEqual({
        legacy: false,
        multiScene: true,
        deployResource: true,
        deployToken: true,
      });
    });

    it('should read the deploy command once', () => {
      expect(mocks.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the deploy command only mentions respond-async', () => {
    beforeEach(async () => {
      files['deploy/index.js'] = "'--programmatic' --help: Prefer: respond-async";
      await read();
    });

    it('should report the deploy resource without a deploy token', () => {
      expect({ deployResource: result.deployResource, deployToken: result.deployToken }).toEqual({
        deployResource: true,
        deployToken: false,
      });
    });
  });

  describe('when the deploy command declares the token flag with double quotes', () => {
    beforeEach(async () => {
      files['deploy/index.js'] =
        'const args = { "--programmatic": Boolean, "--deploy-token": String }';
      await read();
    });

    it('should still report the token flag', () => {
      expect(result.deployToken).toBe(true);
    });
  });

  describe('when the sdk is not installed', () => {
    let error: unknown;

    beforeEach(async () => {
      error = await read().catch(e => e);
    });

    it('should fail, as there is no deploy command to run', () => {
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('deploy', () => {
  let files: Record<string, string>;
  let result: Awaited<ReturnType<typeof deploy>>;
  let args: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    files = { 'deploy/index.js': 'deploy command with --programmatic' };
    const find = (file: string) => {
      const name = Object.keys(files).find(suffix => file.endsWith(suffix));
      if (name === undefined) throw new Error('ENOENT');
      return name;
    };
    mocks.readFile.mockImplementation(async (file: string) => files[find(file)]);
    mocks.stat.mockImplementation(async (file: string) => {
      find(file);
      return { mtimeMs: 1 };
    });
    mocks.runSdkCommand.mockResolvedValue({ stop: vi.fn() });
    mocks.dynamicImport.mockImplementation(async (file: string) =>
      file.endsWith('run-command.js')
        ? { runSdkCommand: mocks.runSdkCommand }
        : { initComponents: vi.fn(async () => ({})) },
    );
  });

  const run = async () => {
    result = await deploy({
      path: `/scenes/scene-${++sceneCount}`,
      chainId: 1,
      wallet: '0xabc',
    });
    args = mocks.runSdkCommand.mock.calls[0][2];
  };

  describe('when the CLI serves the deploy resource and takes a deploy token', () => {
    beforeEach(async () => {
      files['deploy/index.js'] =
        "const args = { '--programmatic': Boolean, '--deploy-token': String }";
      files['deploy/routes.js'] = "router.delete('/api/deploy')";
      await run();
    });

    it('should report the deploy resource as supported', () => {
      expect(result.supportsDeployResource).toBe(true);
    });

    it('should hand out a token for the deployment', () => {
      expect(result.deployToken).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should pass the token to the CLI', () => {
      expect(args.slice(args.indexOf('--deploy-token'))).toEqual([
        '--deploy-token',
        result.deployToken,
      ]);
    });

    it('should return the port the CLI serves', () => {
      expect(result.port).toBe(4000);
    });

    it('should read the deploy command once', () => {
      expect(mocks.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the CLI serves the deploy resource but takes no deploy token', () => {
    beforeEach(async () => {
      files['deploy/routes.js'] = "router.delete('/api/deploy')";
      await run();
    });

    it('should report the deploy resource as supported without a token', () => {
      expect(result).toEqual({ port: 4000, supportsDeployResource: true, deployToken: undefined });
    });

    it('should not pass a token to the CLI', () => {
      expect(args).not.toContain('--deploy-token');
    });
  });

  describe('when a deploy starts while the previous one is still starting', () => {
    let stopFirst: ReturnType<typeof vi.fn>;
    let stopSecond: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      stopFirst = vi.fn();
      stopSecond = vi.fn();
      let releaseFirst: () => void = () => undefined;
      mocks.runSdkCommand
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              releaseFirst = () => resolve({ stop: stopFirst });
            }),
        )
        .mockResolvedValueOnce({ stop: stopSecond });
      const options = { path: `/scenes/scene-${++sceneCount}`, chainId: 1, wallet: '0xabc' };
      const first = deploy(options);
      const second = deploy(options);
      await vi.waitFor(() => expect(mocks.runSdkCommand).toHaveBeenCalledTimes(1));
      releaseFirst();
      await Promise.all([first, second]);
    });

    it('should stop the first CLI before starting the second, leaving none untracked', () => {
      expect({
        firstStops: stopFirst.mock.calls.length,
        secondStops: stopSecond.mock.calls.length,
        starts: mocks.runSdkCommand.mock.calls.length,
      }).toEqual({ firstStops: 1, secondStops: 0, starts: 2 });
    });
  });

  describe('when the CLI predates the deploy resource', () => {
    beforeEach(async () => {
      await run();
    });

    it('should not hand out a token', () => {
      expect(result).toEqual({ port: 4000, supportsDeployResource: false, deployToken: undefined });
    });

    it('should not pass a token to the CLI', () => {
      expect(args).not.toContain('--deploy-token');
    });
  });
});
