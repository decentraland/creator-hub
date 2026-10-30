import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userData: '',
  npmInstall: vi.fn(),
  crossSpawn: vi.fn(),
  ptySpawn: vi.fn(),
}));

vi.mock('node-pty', () => ({ spawn: mocks.ptySpawn }));
vi.mock('cross-spawn', () => ({ default: mocks.crossSpawn }));
vi.mock('../src/modules/npm', () => ({ install: mocks.npmInstall }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => mocks.userData }));
vi.mock('../src/modules/window', () => ({ getWindow: () => null }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/path', () => ({ APP_UNPACKED_PATH: '/nonexistent' }));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({}),
  getChildEnv: () => ({ PATH: '/usr/bin' }),
}));

const managedDir = () => path.join(mocks.userData, 'ai-cli');
const managedBin = (bin: string) => path.join(managedDir(), 'node_modules', '.bin', bin);

function installManaged(bin: string) {
  fs.mkdirSync(path.dirname(managedBin(bin)), { recursive: true });
  fs.writeFileSync(managedBin(bin), '#!/bin/sh\n');
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

/** A login PTY that exits with `code` on the next tick. */
function fakeLogin(code = 0) {
  return () => {
    let onExit: (e: { exitCode: number }) => void = () => {};
    setTimeout(() => onExit({ exitCode: code }), 0);
    return {
      onData: () => {},
      onExit: (cb: typeof onExit) => (onExit = cb),
      kill: vi.fn(),
    };
  };
}

/** A logout process that ends with `event` ('exit' with a code, or 'error'). */
function fakeLogout(event: 'exit' | 'error' | 'hang', code = 0) {
  return () => {
    const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
    if (event === 'exit') setTimeout(() => child.emit('exit', code), 0);
    if (event === 'error') setTimeout(() => child.emit('error', new Error('ENOENT')), 0);
    return child;
  };
}

async function loadModule() {
  vi.resetModules();
  return {
    ...(await import('../src/modules/ai-cli')),
    paths: await import('../src/modules/ai-cli-paths'),
  };
}

beforeEach(() => {
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-cli-'));
  mocks.npmInstall.mockReset();
  mocks.npmInstall.mockImplementation(async () => {});
  mocks.crossSpawn.mockReset();
  mocks.crossSpawn.mockImplementation(fakeLogout('exit', 0));
  mocks.ptySpawn.mockReset();
  mocks.ptySpawn.mockImplementation(fakeLogin(0));
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(mocks.userData, { recursive: true, force: true });
});

describe('updateManagedClis', () => {
  it('should update an app-installed Codex to the latest version without install scripts', async () => {
    installManaged('codex');
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    expect(mocks.npmInstall).toHaveBeenCalledWith(managedDir(), ['@openai/codex@latest'], {
      ignoreScripts: true,
    });
  });

  it('should update only once per app run', async () => {
    installManaged('codex');
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    await updateManagedClis();
    expect(mocks.npmInstall).toHaveBeenCalledTimes(1);
  });

  it('should not install anything the user never installed', async () => {
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    expect(mocks.npmInstall).not.toHaveBeenCalled();
  });

  it('should skip CLIs the app no longer signs in to', async () => {
    installManaged('claude');
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    expect(mocks.npmInstall).not.toHaveBeenCalled();
  });

  it('should keep the installed copy when the update fails', async () => {
    installManaged('codex');
    mocks.npmInstall.mockRejectedValue(new Error('offline'));
    const { updateManagedClis } = await loadModule();
    await expect(updateManagedClis()).resolves.toBeUndefined();
  });
});

describe('whenManagedCliIdle', () => {
  it('should wait for a running update to finish', async () => {
    installManaged('codex');
    const npm = deferred();
    mocks.npmInstall.mockReturnValue(npm.promise);
    const { updateManagedClis, whenManagedCliIdle } = await loadModule();
    void updateManagedClis();
    let idle = false;
    void whenManagedCliIdle().then(() => (idle = true));
    await new Promise(r => setTimeout(r, 10));
    expect(idle).toBe(false);
    npm.resolve();
    await new Promise(r => setTimeout(r, 0));
    expect(idle).toBe(true);
  });
});

describe('startTurnWhenIdle', () => {
  it('should hold a turn until a running update finishes', async () => {
    installManaged('codex');
    const npm = deferred();
    mocks.npmInstall.mockReturnValue(npm.promise);
    const { updateManagedClis, startTurnWhenIdle } = await loadModule();
    void updateManagedClis();
    const startTurn = vi.fn(async () => 'turn-1');
    const turn = startTurnWhenIdle(startTurn);
    await new Promise(r => setTimeout(r, 10));
    expect(startTurn).not.toHaveBeenCalled();
    npm.resolve();
    await expect(turn).resolves.toBe('turn-1');
  });
});

describe('detectThenUpdate', () => {
  it('should start the update after the scan', async () => {
    installManaged('codex');
    const { detectThenUpdate } = await loadModule();
    const detect = vi.fn(async () => {
      expect(mocks.npmInstall).not.toHaveBeenCalled();
      return [];
    });
    await detectThenUpdate(detect, () => false);
    expect(detect).toHaveBeenCalled();
    expect(mocks.npmInstall).toHaveBeenCalledTimes(1);
  });

  it('should not start an update while a turn runs', async () => {
    installManaged('codex');
    const { detectThenUpdate } = await loadModule();
    await detectThenUpdate(
      async () => [],
      () => true,
    );
    expect(mocks.npmInstall).not.toHaveBeenCalled();
  });

  it('should not start an update while a turn is starting', async () => {
    installManaged('codex');
    const { detectThenUpdate, startTurnWhenIdle } = await loadModule();
    const turnStarted = deferred();
    const turn = startTurnWhenIdle(() => turnStarted.promise);
    await detectThenUpdate(
      async () => [],
      () => false,
    );
    expect(mocks.npmInstall).not.toHaveBeenCalled();
    turnStarted.resolve();
    await turn;
  });

  it('should scan only once a running update is done', async () => {
    installManaged('codex');
    const npm = deferred();
    mocks.npmInstall.mockReturnValue(npm.promise);
    const { updateManagedClis, detectThenUpdate } = await loadModule();
    void updateManagedClis();
    const detect = vi.fn(async () => []);
    const scan = detectThenUpdate(detect, () => false);
    await new Promise(r => setTimeout(r, 10));
    expect(detect).not.toHaveBeenCalled();
    npm.resolve();
    await scan;
    expect(detect).toHaveBeenCalled();
  });
});

describe('signInCli', () => {
  it('should not run npm again when this run already updated the CLI', async () => {
    installManaged('codex');
    const { updateManagedClis, signInCli } = await loadModule();
    await updateManagedClis();
    await signInCli('codex');
    expect(mocks.npmInstall).toHaveBeenCalledTimes(1);
    expect(mocks.ptySpawn).toHaveBeenCalledTimes(1);
  });

  it('should wait for a running update instead of starting a second npm run', async () => {
    installManaged('codex');
    const npm = deferred();
    mocks.npmInstall.mockReturnValue(npm.promise);
    const { updateManagedClis, signInCli } = await loadModule();
    void updateManagedClis();
    const signIn = signInCli('codex');
    await new Promise(r => setTimeout(r, 10));
    expect(mocks.ptySpawn).not.toHaveBeenCalled();
    npm.resolve();
    await signIn;
    expect(mocks.npmInstall).toHaveBeenCalledTimes(1);
    expect(mocks.ptySpawn).toHaveBeenCalledTimes(1);
  });

  it('should update a CLI this run has not updated yet', async () => {
    installManaged('codex');
    const { signInCli } = await loadModule();
    await signInCli('codex');
    expect(mocks.npmInstall).toHaveBeenCalledTimes(1);
  });

  it('should not open the login when cancelled while npm runs', async () => {
    installManaged('codex');
    const npm = deferred();
    mocks.npmInstall.mockReturnValue(npm.promise);
    const { signInCli, cancelSignInCli } = await loadModule();
    const signIn = signInCli('codex');
    await cancelSignInCli();
    npm.resolve();
    await expect(signIn).rejects.toThrow('Sign-in cancelled');
    expect(mocks.ptySpawn).not.toHaveBeenCalled();
  });
});

describe('signOutCli', () => {
  it('should sign Codex out with its own logout command and clear the marker', async () => {
    installManaged('codex');
    const { signOutCli, paths } = await loadModule();
    paths.setSignedIn('codex', true);
    await signOutCli('codex');
    expect(mocks.crossSpawn).toHaveBeenCalledWith(
      managedBin('codex'),
      ['logout'],
      expect.anything(),
    );
    expect(paths.isSignedIn('codex')).toBe(false);
  });

  it('should report a logout that exits with an error and keep the marker', async () => {
    installManaged('codex');
    mocks.crossSpawn.mockImplementation(fakeLogout('exit', 1));
    const { signOutCli, paths } = await loadModule();
    paths.setSignedIn('codex', true);
    await expect(signOutCli('codex')).rejects.toThrow('exit code 1');
    expect(paths.isSignedIn('codex')).toBe(true);
  });

  it('should report a logout command that cannot start', async () => {
    installManaged('codex');
    mocks.crossSpawn.mockImplementation(fakeLogout('error'));
    const { signOutCli } = await loadModule();
    await expect(signOutCli('codex')).rejects.toThrow('ENOENT');
  });

  it('should give up on a logout that never exits', async () => {
    installManaged('codex');
    const hung = fakeLogout('hang');
    let child: ReturnType<typeof hung> | undefined;
    mocks.crossSpawn.mockImplementation(() => (child = hung()));
    const { signOutCli } = await loadModule();
    vi.useFakeTimers();
    const signOut = signOutCli('codex');
    const assertion = expect(signOut).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(child?.kill).toHaveBeenCalled();
  });
});
