import { afterEach, vi } from 'vitest';

// Mock preload modules
vi.mock('#preload', () => ({
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    exists: vi.fn(),
  },
  custom: {
    getPath: vi.fn(),
    getEnv: vi.fn(),
  },
  analytics: {
    track: vi.fn(),
    identify: vi.fn(),
  },
  editor: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
  npm: {
    install: vi.fn(),
    uninstall: vi.fn(),
    list: vi.fn(),
  },
  workspace: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  },
  scene: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
  settings: {
    get: vi.fn(),
    set: vi.fn(),
  },
  misc: {
    openExternal: vi.fn(),
    showMessage: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});
