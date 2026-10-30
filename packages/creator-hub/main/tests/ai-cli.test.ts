import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userData: '',
  npmInstall: vi.fn(async () => {}),
  crossSpawn: vi.fn(),
}));

vi.mock('node-pty', () => ({ spawn: vi.fn() }));
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

function installManaged(bin: string) {
  const dir = path.join(mocks.userData, 'ai-cli', 'node_modules', '.bin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, bin), '#!/bin/sh\n');
}

async function loadModule() {
  vi.resetModules();
  return import('../src/modules/ai-cli');
}

beforeEach(() => {
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-ai-cli-'));
  mocks.npmInstall.mockReset();
  mocks.npmInstall.mockImplementation(async () => {});
  mocks.crossSpawn.mockReset();
  mocks.crossSpawn.mockImplementation(() => {
    const child = new EventEmitter();
    setTimeout(() => child.emit('exit', 0), 0);
    return child;
  });
});

afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true });
});

describe('updateManagedClis', () => {
  it('should update an app-installed Codex to the latest version', async () => {
    installManaged('codex');
    const { updateManagedClis } = await loadModule();
    await updateManagedClis();
    expect(mocks.npmInstall).toHaveBeenCalledWith(path.join(mocks.userData, 'ai-cli'), [
      '@openai/codex@latest',
    ]);
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

describe('signOutCli', () => {
  it('should sign Codex out with its own logout command', async () => {
    installManaged('codex');
    const { signOutCli } = await loadModule();
    await signOutCli('codex');
    expect(mocks.crossSpawn).toHaveBeenCalledWith(
      path.join(mocks.userData, 'ai-cli', 'node_modules', '.bin', 'codex'),
      ['logout'],
      expect.anything(),
    );
  });

  it('should still clear the app state when the logout command cannot start', async () => {
    installManaged('codex');
    mocks.crossSpawn.mockImplementation(() => {
      const child = new EventEmitter();
      setTimeout(() => child.emit('error', new Error('ENOENT')), 0);
      return child;
    });
    const { signOutCli } = await loadModule();
    await expect(signOutCli('codex')).resolves.toBeUndefined();
  });
});
