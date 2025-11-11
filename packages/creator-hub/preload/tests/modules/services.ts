import path from 'node:path';
import { vi, type Mock } from 'vitest';

import type { Services } from '../../src/services';

type DeepMock<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? Mock : DeepMock<T[K]>;
};

export const getMockServices = (): DeepMock<Services> => ({
  config: {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    getWorkspaceConfigPath: vi.fn(),
  },
  fs: {
    stat: vi.fn(),
    mkdir: vi.fn(),
    exists: vi.fn(),
    writeFile: vi.fn(),
    resolve: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    isDirectory: vi.fn(),
    cp: vi.fn(),
    isWritable: vi.fn(),
    rmdir: vi.fn(),
    openPath: vi.fn(),
  },
  ipc: {
    invoke: vi.fn(),
  },
  path: {
    join: vi.fn((...args) => path.posix.join(...args)),
    basename: vi.fn((arg: string) => path.posix.basename(arg)),
    normalize: vi.fn((arg: string) => path.posix.normalize(arg)),
  } as any, // temp until we have a "path" service...
  npm: {
    install: vi.fn(),
    getOutdatedDeps: vi.fn(),
    getContextFiles: vi.fn(),
  },
  pkg: {
    getPackageJson: vi.fn(),
    getPackageVersion: vi.fn(),
    hasDependency: vi.fn(),
  },
  project: {
    getProjectInfoFs: vi.fn(),
  },
});
