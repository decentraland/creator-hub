import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = await vi.hoisted(async () => {
  const os = await import('os');
  const path = await import('path');
  return {
    appDir: path.join(os.tmpdir(), 'node-runtime-test-app'),
    warn: vi.fn(),
    getBinPath: vi.fn(
      (_pkg: string, bin: string) => `/fake/app/node_modules/npm/bin/${bin}-cli.js`,
    ),
  };
});

vi.mock('electron', () => ({ app: { getAppPath: () => '/fake' } }));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: mocks.warn, error: vi.fn() },
}));
vi.mock('../src/modules/path', () => ({
  APP_UNPACKED_PATH: mocks.appDir,
  getBinPath: mocks.getBinPath,
  joinEnvPaths: (...paths: (string | undefined)[]) => paths.filter(Boolean).join(path.delimiter),
}));

import { getChildEnv, resolveNodeRuntime, type NodeRuntime } from '../src/modules/node-runtime';

function touch(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
}

describe('when resolving the Node runtime for child processes', () => {
  let tmpDir: string;
  let resourcesDir: string;
  let systemDir: string;
  let osPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-runtime-test-'));
    resourcesDir = path.join(tmpDir, 'resources');
    systemDir = path.join(tmpDir, 'system', 'bin');
    fs.mkdirSync(systemDir, { recursive: true });
    fs.mkdirSync(mocks.appDir, { recursive: true });
    osPath = [mocks.appDir, systemDir, '/usr/bin'].join(path.delimiter);
    vi.stubEnv('DEV', '');
    vi.stubEnv('TEST', '');
    vi.stubEnv('PATH', osPath);
    Object.defineProperty(process, 'resourcesPath', { value: resourcesDir, configurable: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(mocks.appDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('and the bundled node-bin is present', () => {
    let bundledNode: string;

    beforeEach(() => {
      bundledNode = path.join(resourcesDir, 'node-bin', 'bin', 'node');
      touch(bundledNode);
      touch(path.join(resourcesDir, 'node-bin', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'));
      touch(path.join(resourcesDir, 'node-bin', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'));
      touch(path.join(systemDir, 'node'));
    });

    it('should resolve the bundled runtime with its own npm and npx', () => {
      expect(resolveNodeRuntime()).toEqual<NodeRuntime>({
        source: 'bundled',
        node: bundledNode,
        binDir: path.dirname(bundledNode),
        npmCli: path.join(
          resourcesDir,
          'node-bin',
          'lib',
          'node_modules',
          'npm',
          'bin',
          'npm-cli.js',
        ),
        npxCli: path.join(
          resourcesDir,
          'node-bin',
          'lib',
          'node_modules',
          'npm',
          'bin',
          'npx-cli.js',
        ),
      });
    });

    it('should not warn', () => {
      resolveNodeRuntime();
      expect(mocks.warn).not.toHaveBeenCalled();
    });
  });

  describe('and node-bin is missing but a real Node is on PATH', () => {
    let systemNode: string;

    beforeEach(() => {
      systemNode = path.join(systemDir, 'node');
      touch(systemNode);
      touch(path.join(mocks.appDir, 'node'));
    });

    it('should resolve the system runtime, skipping the app shim', () => {
      expect(resolveNodeRuntime()).toMatchObject({
        source: 'system',
        node: systemNode,
        binDir: systemDir,
      });
    });

    it('should fall back to the app npm when the system Node ships none', () => {
      expect(resolveNodeRuntime()).toMatchObject({
        npmCli: '/fake/app/node_modules/npm/bin/npm-cli.js',
        npxCli: '/fake/app/node_modules/npm/bin/npx-cli.js',
      });
    });

    it('should use the npm shipped next to the system Node when it exists', () => {
      const npmCli = path.join(tmpDir, 'system', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
      touch(npmCli);
      expect(resolveNodeRuntime().npmCli).toBe(npmCli);
    });

    it('should warn that the system Node is used instead of the bundled one', () => {
      resolveNodeRuntime();
      expect(mocks.warn).toHaveBeenCalledWith(expect.stringMatching(/system Node/));
    });
  });

  describe('and neither the bundled nor a system Node exists', () => {
    beforeEach(() => {
      touch(path.join(mocks.appDir, 'node'));
    });

    it('should resolve Electron as Node with the app npm', () => {
      expect(resolveNodeRuntime()).toEqual<NodeRuntime>({
        source: 'electron',
        node: process.execPath,
        binDir: mocks.appDir,
        npmCli: '/fake/app/node_modules/npm/bin/npm-cli.js',
        npxCli: '/fake/app/node_modules/npm/bin/npx-cli.js',
      });
    });

    it('should warn that Electron is used instead of the bundled one', () => {
      resolveNodeRuntime();
      expect(mocks.warn).toHaveBeenCalledWith(expect.stringMatching(/Electron/));
    });
  });

  describe('and running in development', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', '1');
      touch(path.join(resourcesDir, 'node-bin', 'bin', 'node'));
      touch(path.join(systemDir, 'node'));
    });

    it('should resolve the system Node even if a bundle exists', () => {
      expect(resolveNodeRuntime().source).toBe('system');
    });

    it('should not warn', () => {
      resolveNodeRuntime();
      expect(mocks.warn).not.toHaveBeenCalled();
    });
  });
});

describe('when building the env for a child process', () => {
  let osPath: string;

  beforeEach(() => {
    osPath = ['/usr/bin', '/bin'].join(path.delimiter);
    vi.stubEnv('PATH', osPath);
    vi.stubEnv('ELECTRON_RUN_AS_NODE', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('and the runtime is a real Node', () => {
    let runtime: NodeRuntime;

    beforeEach(() => {
      runtime = {
        source: 'bundled',
        node: '/bundle/bin/node',
        binDir: '/bundle/bin',
        npmCli: '/bundle/lib/node_modules/npm/bin/npm-cli.js',
        npxCli: '/bundle/lib/node_modules/npm/bin/npx-cli.js',
      };
    });

    it('should put the runtime bin dir, then the app shim dir, ahead of the OS PATH', () => {
      expect(getChildEnv(runtime).PATH).toBe(
        ['/bundle/bin', mocks.appDir, '/usr/bin', '/bin'].join(path.delimiter),
      );
    });

    it('should drop ELECTRON_RUN_AS_NODE', () => {
      expect(getChildEnv(runtime)).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
    });

    it('should layer the extra env on top of the process env', () => {
      expect(getChildEnv(runtime, { ANALYTICS_APP_ID: 'creator-hub' })).toMatchObject({
        ANALYTICS_APP_ID: 'creator-hub',
        HOME: process.env.HOME,
      });
    });
  });

  describe('and the runtime is Electron', () => {
    let runtime: NodeRuntime;

    beforeEach(() => {
      vi.stubEnv('ELECTRON_RUN_AS_NODE', '');
      runtime = {
        source: 'electron',
        node: process.execPath,
        binDir: mocks.appDir,
        npmCli: '/fake/app/node_modules/npm/bin/npm-cli.js',
        npxCli: '/fake/app/node_modules/npm/bin/npx-cli.js',
      };
    });

    it('should set ELECTRON_RUN_AS_NODE so the node shim behaves as Node', () => {
      expect(getChildEnv(runtime).ELECTRON_RUN_AS_NODE).toBe('1');
    });
  });
});
