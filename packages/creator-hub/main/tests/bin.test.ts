import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBinPath: vi.fn(),
  fork: vi.fn(),
}));

vi.mock('electron', () => ({ utilityProcess: { fork: mocks.fork } }));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../src/modules/path', () => ({
  APP_UNPACKED_PATH: '/fake/app',
  getBinPath: mocks.getBinPath,
  joinEnvPaths: (...paths: (string | undefined)[]) => paths.filter(Boolean).join(':'),
}));
vi.mock('../src/modules/setup-node', () => ({ setupNodeBinary: vi.fn() }));

import { run } from '../src/modules/bin';

describe('when running a script on a real Node binary instead of an Electron utility process', () => {
  let tmpDir: string;
  let scriptPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bin-test-'));
    scriptPath = path.join(tmpDir, 'script.js');
    mocks.getBinPath.mockReturnValue(scriptPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.ELECTRON_RUN_AS_NODE;
    vi.clearAllMocks();
  });

  it('should not fork an Electron utility process', async () => {
    fs.writeFileSync(scriptPath, 'process.exit(0)');

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });
    await child.wait();

    expect(mocks.fork).not.toHaveBeenCalled();
  });

  it('should capture output written by the script', async () => {
    fs.writeFileSync(scriptPath, 'console.log("hello from the script")');

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });
    const output = await child.wait();

    expect(output.toString('utf8')).toContain('hello from the script');
  });

  it('should resolve waitFor when the script prints a matching line', async () => {
    fs.writeFileSync(scriptPath, 'console.log("server ready on port 1234")');

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });

    await expect(child.waitFor(/server ready on port (\d+)/)).resolves.toContain('1234');
  });

  it('should reject with the script output when it exits with a non-zero code', async () => {
    fs.writeFileSync(scriptPath, 'console.error("it broke"); process.exit(1)');

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });

    await expect(child.wait()).rejects.toThrow(/exited with code=1/);
  });

  // The whole reason this branch exists: children of this process inherit `process.execPath`,
  // so it has to be a real Node — not Electron pretending to be one via ELECTRON_RUN_AS_NODE.
  it('should give the script a real Node runtime, with no Electron in its versions', async () => {
    fs.writeFileSync(
      scriptPath,
      'console.log(JSON.stringify({ electron: process.versions.electron ?? null, execPath: process.execPath }))',
    );

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });
    const reported = JSON.parse((await child.wait()).toString('utf8'));

    expect(reported.electron).toBeNull();
    expect(reported.execPath).toBe(process.execPath);
  });

  // node-gyp-build reads this variable as "load an Electron-tagged native build", which would
  // fail on a real Node runtime — so it must not survive into the child.
  it('should not pass ELECTRON_RUN_AS_NODE down to the script', async () => {
    fs.writeFileSync(
      scriptPath,
      'console.log(JSON.stringify(process.env.ELECTRON_RUN_AS_NODE ?? null))',
    );
    process.env.ELECTRON_RUN_AS_NODE = '1';

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });
    const reported = JSON.parse((await child.wait()).toString('utf8'));

    expect(reported).toBeNull();
  });

  it('should put the Node binary directory first on the PATH it passes down', async () => {
    fs.writeFileSync(scriptPath, 'console.log(process.env.PATH)');

    const child = run('some-pkg', 'some-bin', { cwd: tmpDir, nodePath: process.execPath });
    const reportedPath = (await child.wait()).toString('utf8').trim();

    expect(reportedPath.split(':')[0]).toBe(path.dirname(process.execPath));
  });
});
