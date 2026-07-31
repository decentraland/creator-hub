import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';

import { DEFAULT_DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import type { Config } from '/shared/types/config';

vi.mock('node:fs', () => ({ existsSync: vi.fn() }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: vi.fn(() => '/user/data') }));
vi.mock('../src/modules/migrations', () => ({ waitForMigrations: vi.fn(async () => undefined) }));

let storedConfig: Partial<Config>;
const storage = {
  getAll: vi.fn(async () => storedConfig),
  setAll: vi.fn(async (config: Config) => {
    storedConfig = config;
  }),
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
