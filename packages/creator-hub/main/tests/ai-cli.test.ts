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
  send: vi.fn(),
}));

vi.mock('node-pty', () => ({ spawn: mocks.ptySpawn }));
vi.mock('cross-spawn', () => ({ default: mocks.crossSpawn }));
vi.mock('../src/modules/npm', () => ({ install: mocks.npmInstall }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => mocks.userData }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({ isDestroyed: () => false, webContents: { send: mocks.send } }),
}));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/path', () => ({ APP_UNPACKED_PATH: '/nonexistent' }));
vi.mock('../src/modules/node-runtime', () => ({
  resolveNodeRuntime: () => ({ node: '/bundle/node' }),
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

/** A login PTY that prints `chunks`, then stays open until killed, recording what is typed. */
function interactiveLogin(chunks: string[]) {
  const pty = { written: [] as string[], kill: vi.fn() };
  mocks.ptySpawn.mockImplementation(() => {
    let onData: (data: string) => void = () => {};
    setTimeout(() => chunks.forEach(chunk => onData(chunk)), 0);
    return {
      onData: (cb: typeof onData) => (onData = cb),
      onExit: () => {},
      write: (data: string) => pty.written.push(data),
      kill: pty.kill,
    };
  });
  return pty;
}

const loginEvents = () => mocks.send.mock.calls.map(([, event]) => event);

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
  mocks.send.mockReset();
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

  it('should skip CLIs the app does not sign in to', async () => {
    installManaged('cursor-agent');
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

describe('when the app manages Claude Code', () => {
  const claudeDir = () => path.join(managedDir(), 'node_modules', '@anthropic-ai/claude-code');
  const setupCall = () => [
    '/bundle/node',
    [path.join(claudeDir(), 'install.cjs')],
    expect.objectContaining({ cwd: claudeDir() }),
  ];
  const signInUrl =
    'https://claude.com/cai/oauth/authorize?code=true&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&state=abc';

  it('should install it without scripts, then run its own setup to put the native binary in place', async () => {
    mocks.npmInstall.mockImplementation(async () => installManaged('claude'));
    const { signInCli } = await loadModule();
    await signInCli('claude');
    expect(mocks.npmInstall).toHaveBeenCalledWith(
      managedDir(),
      ['@anthropic-ai/claude-code@latest'],
      { ignoreScripts: true },
    );
    expect(mocks.crossSpawn).toHaveBeenCalledWith(...setupCall());
  });

  it('should fail the install when its setup fails', async () => {
    mocks.npmInstall.mockImplementation(async () => installManaged('claude'));
    mocks.crossSpawn.mockImplementation(fakeLogout('exit', 1));
    const { signInCli } = await loadModule();
    await expect(signInCli('claude')).rejects.toThrow('setup failed');
    expect(mocks.ptySpawn).not.toHaveBeenCalled();
  });

  it('should run its setup after every update', async () => {
    installManaged('claude');
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    expect(mocks.crossSpawn).toHaveBeenCalledWith(...setupCall());
  });

  it('should sign in with the Claude subscription login', async () => {
    installManaged('claude');
    const { signInCli, paths } = await loadModule();
    await signInCli('claude');
    expect(mocks.ptySpawn).toHaveBeenCalledWith(
      managedBin('claude'),
      ['auth', 'login', '--claudeai'],
      expect.anything(),
    );
    expect(paths.isSignedIn('claude')).toBe(true);
  });

  it('should pass on the sign-in URL from inside its terminal hyperlink, and accept a code', async () => {
    installManaged('claude');
    interactiveLogin([
      'Opening browser to sign in…\r\n',
      `If the browser didn't open, visit: \u001b]8;;${signInUrl}\u0007\u001b[94m${signInUrl}\u001b[39m\u001b]8;;\u0007\r\n`,
      'Paste code here if prompted > ',
    ]);
    const { signInCli, cancelSignInCli } = await loadModule();
    void signInCli('claude').catch(() => {});
    await vi.waitFor(() =>
      expect(loginEvents()).toContainEqual({ type: 'auth', url: signInUrl, acceptsCode: true }),
    );
    await cancelSignInCli();
  });

  it('should type a pasted code at the login prompt as one line', async () => {
    installManaged('claude');
    const pty = interactiveLogin([]);
    const { signInCli, submitSignInCode, cancelSignInCli } = await loadModule();
    void signInCli('claude').catch(() => {});
    await vi.waitFor(() => expect(mocks.ptySpawn).toHaveBeenCalled());
    await submitSignInCode('  abc123#state456\n');
    expect(pty.written).toEqual(['abc123#state456\r']);
    await cancelSignInCli();
  });

  it('should fail the sign-in when Claude Code rejects the code, although it keeps running', async () => {
    installManaged('claude');
    const pty = interactiveLogin([
      'Paste code here if prompted > ',
      "Login failed: That code wasn't accepted. Sign in again to get a new code.\r\n",
    ]);
    const { signInCli, paths } = await loadModule();
    await expect(signInCli('claude')).rejects.toThrow(
      /^Login failed: That code wasn't accepted\. Sign in again to get a new code\.$/,
    );
    expect(pty.kill).toHaveBeenCalled();
    expect(paths.isSignedIn('claude')).toBe(false);
  });

  it('should sign Claude Code out with its own logout command', async () => {
    installManaged('claude');
    const { signOutCli } = await loadModule();
    await signOutCli('claude');
    expect(mocks.crossSpawn).toHaveBeenCalledWith(
      managedBin('claude'),
      ['auth', 'logout'],
      expect.anything(),
    );
  });
});

describe('submitSignInCode', () => {
  it('should refuse a code when no sign-in is running', async () => {
    const { submitSignInCode } = await loadModule();
    await expect(submitSignInCode('abc#def')).rejects.toThrow('No sign-in is in progress');
  });
});
