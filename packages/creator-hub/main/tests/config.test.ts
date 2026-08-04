import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';

import { DEFAULT_DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import type { Config, EditorConfig } from '/shared/types/config';

vi.mock('node:fs', () => ({ existsSync: vi.fn() }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: vi.fn(() => '/user/data') }));
vi.mock('../src/modules/migrations', () => ({ waitForMigrations: vi.fn(async () => undefined) }));

let storedConfig: Partial<Config>;
const storage = {
  get: vi.fn(async (key: keyof Config) => storedConfig[key]),
  getAll: vi.fn(async () => storedConfig),
  set: vi.fn(async (key: string, value: unknown) => {
    (storedConfig as Record<string, unknown>)[key] = value;
  }),
  setAll: vi.fn(async (config: Config) => {
    storedConfig = config;
  }),
  has: vi.fn(async (key: string) => key in storedConfig),
};

vi.mock('/shared/types/storage', () => ({
  FileSystemStorage: { getOrCreate: vi.fn(async () => storage) },
}));

describe('getConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('when the stored config has optimize-assets entries for projects that no longer exist on disk', () => {
    beforeEach(() => {
      storedConfig = {
        version: 2,
        workspace: { paths: ['/projects/alive'] },
        settings: {
          scenesPath: '/user/data/Scenes',
          dependencyUpdateStrategy: DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
          previewOptions: {
            debugger: false,
            skipAuthScreen: true,
            enableLandscapeTerrains: true,
            openNewInstance: false,
            multiInstance: false,
            showWarnings: true,
            optimizedAssets: false,
          },
          optimizedAssetsByPath: {
            '/projects/alive': true,
            '/projects/gone': true,
            '/projects/also-gone': false,
          },
        },
      };
      vi.mocked(existsSync).mockImplementation(path => path === '/projects/alive');
    });

    it('should prune the entries whose project path is missing and keep the rest', async () => {
      const { getConfig } = await import('../src/modules/config');
      const config = await getConfig();

      expect(config.settings.optimizedAssetsByPath).toEqual({ '/projects/alive': true });
    });

    it('should persist the pruned config to storage', async () => {
      const { getConfig } = await import('../src/modules/config');
      await getConfig();

      expect(storage.setAll).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            optimizedAssetsByPath: { '/projects/alive': true },
          }),
        }),
      );
    });
  });

  describe('when every optimize-assets entry points to an existing project', () => {
    beforeEach(() => {
      storedConfig = {
        version: 2,
        workspace: { paths: [] },
        settings: {
          scenesPath: '/user/data/Scenes',
          dependencyUpdateStrategy: DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
          previewOptions: {
            debugger: false,
            skipAuthScreen: true,
            enableLandscapeTerrains: true,
            openNewInstance: false,
            multiInstance: false,
            showWarnings: true,
            optimizedAssets: false,
          },
          optimizedAssetsByPath: { '/projects/alive': true },
        },
      };
      vi.mocked(existsSync).mockReturnValue(true);
    });

    it('should keep all entries', async () => {
      const { getConfig } = await import('../src/modules/config');
      const config = await getConfig();

      expect(config.settings.optimizedAssetsByPath).toEqual({ '/projects/alive': true });
    });
  });
});

describe('writeConfig', () => {
  const DISCOVERED_EDITOR: EditorConfig = {
    name: 'VSCode',
    // What editor discovery actually stores on macOS: the inner Mach-O, not the `.app`.
    path: '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
    isDefault: true,
    hidden: false,
  };

  /**
   * Loads a fresh module and lets it merge defaults into the store, so a test can seed
   * `storedConfig` afterwards and still be reading the shape the app would have.
   */
  async function load() {
    const module = await import('../src/modules/config');
    await module.getConfig();
    return module;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    storedConfig = {};
    vi.mocked(existsSync).mockReturnValue(true);
  });

  describe('when the submitted config carries a different editor list', () => {
    it('should keep the stored editors and ignore the submitted ones', async () => {
      const { getConfig, writeConfig } = await load();
      storedConfig.editors = [DISCOVERED_EDITOR];

      const stored = await getConfig();
      await writeConfig({
        ...stored,
        editors: [
          {
            name: 'Submitted',
            path: '/usr/local/bin/other-editor',
            isDefault: true,
            hidden: false,
          },
        ],
      } as Config);

      expect((await getConfig()).editors).toEqual([DISCOVERED_EDITOR]);
    });

    it('should not let the editor list be cleared', async () => {
      const { getConfig, writeConfig } = await load();
      storedConfig.editors = [DISCOVERED_EDITOR];

      const stored = await getConfig();
      await writeConfig({ ...stored, editors: [] } as Config);

      expect((await getConfig()).editors).toEqual([DISCOVERED_EDITOR]);
    });
  });

  describe('when the submitted config carries fields main owns', () => {
    it('should keep the stored values for all of them', async () => {
      const { getConfig, writeConfig } = await load();
      Object.assign(storedConfig, {
        editors: [DISCOVERED_EDITOR],
        userId: 'stored-user',
        installedAt: '2026-01-01T00:00:00.000Z',
        lastVersion: '1.2.3',
      });

      const stored = await getConfig();
      await writeConfig({
        ...stored,
        userId: 'submitted-user',
        installedAt: '2020-01-01T00:00:00.000Z',
        lastVersion: '9.9.9',
      });

      const written = await getConfig();
      expect(written.userId).toBe('stored-user');
      expect(written.installedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(written.lastVersion).toBe('1.2.3');
    });
  });

  describe('when the submitted config changes workspace and settings', () => {
    it('should persist both', async () => {
      const { getConfig, writeConfig } = await load();
      storedConfig.editors = [DISCOVERED_EDITOR];

      const stored = await getConfig();
      await writeConfig({
        ...stored,
        workspace: { paths: ['/projects/added'] },
        settings: { ...stored.settings, scenesPath: '/somewhere/else' },
      });

      const written = await getConfig();
      expect(written.workspace.paths).toEqual(['/projects/added']);
      expect(written.settings.scenesPath).toBe('/somewhere/else');
      expect(written.editors).toEqual([DISCOVERED_EDITOR]);
    });
  });
});
