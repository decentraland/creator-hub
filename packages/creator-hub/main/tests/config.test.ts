import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Config, EditorConfig } from '/shared/types/config';

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

  describe('when the stored config carries the retired Compress Assets keys', () => {
    beforeEach(async () => {
      const { getDefaultConfig } = await import('../src/modules/config');
      storedConfig = getDefaultConfig();
      storedConfig.settings!.aiAssistantPromoted = true;
      storedConfig.settings!.debugConsolePromoted = true;
      Object.assign(storedConfig.settings!.previewOptions, { optimizedAssets: true });
      Object.assign(storedConfig.settings!, {
        optimizedAssetsByPath: { '/projects/alive': true },
      });
      vi.resetModules();
    });

    it('should write the config back without them', async () => {
      const { getConfig } = await import('../src/modules/config');
      await getConfig();

      expect(storage.setAll).toHaveBeenCalledTimes(1);
      const written = storage.setAll.mock.calls[0][0] as Config;
      expect('optimizedAssetsByPath' in written.settings).toBe(false);
      expect('optimizedAssets' in written.settings.previewOptions).toBe(false);
      expect(written.settings.previewOptions.loadRawGltfs).toBe(false);
    });

    it('should write nothing on the next launch', async () => {
      const first = await import('../src/modules/config');
      await first.getConfig();
      vi.resetModules();
      storage.setAll.mockClear();

      const second = await import('../src/modules/config');
      await second.getConfig();

      expect(storage.setAll).not.toHaveBeenCalled();
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

describe('the one-time AI assistant promotion', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('when the stored config predates the promotion', () => {
    it('should persist the assistant as enabled and marked', async () => {
      const { getConfig, getDefaultConfig } = await import('../src/modules/config');
      storedConfig = getDefaultConfig();
      storedConfig.settings!.aiAssistant = false;

      await getConfig();

      expect(storage.setAll).toHaveBeenCalledTimes(1);
      const written = storage.setAll.mock.calls[0][0] as Config;
      expect(written.settings.aiAssistant).toBe(true);
      expect(written.settings.aiAssistantPromoted).toBe(true);
    });
  });

  describe('when the creator turned the assistant off after the promotion ran', () => {
    it('should leave it off and write nothing', async () => {
      const { getConfig, getDefaultConfig } = await import('../src/modules/config');
      storedConfig = getDefaultConfig();
      storedConfig.settings!.aiAssistant = false;
      storedConfig.settings!.aiAssistantPromoted = true;
      storedConfig.settings!.debugConsolePromoted = true;

      const config = await getConfig();

      expect(config.settings.aiAssistant).toBe(false);
      expect(storage.setAll).not.toHaveBeenCalled();
    });
  });
});

describe('the one-time debug console promotion', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('when the stored config predates the promotion', () => {
    it('should persist the debug console as enabled and marked', async () => {
      const { getConfig, getDefaultConfig } = await import('../src/modules/config');
      storedConfig = getDefaultConfig();
      storedConfig.settings!.previewOptions.debugger = false;

      await getConfig();

      expect(storage.setAll).toHaveBeenCalledTimes(1);
      const written = storage.setAll.mock.calls[0][0] as Config;
      expect(written.settings.previewOptions.debugger).toBe(true);
      expect(written.settings.debugConsolePromoted).toBe(true);
    });
  });

  describe('when the creator turned the debug console off after the promotion ran', () => {
    it('should leave it off and write nothing', async () => {
      const { getConfig, getDefaultConfig } = await import('../src/modules/config');
      storedConfig = getDefaultConfig();
      storedConfig.settings!.previewOptions.debugger = false;
      storedConfig.settings!.aiAssistantPromoted = true;
      storedConfig.settings!.debugConsolePromoted = true;

      const config = await getConfig();

      expect(config.settings.previewOptions.debugger).toBe(false);
      expect(storage.setAll).not.toHaveBeenCalled();
    });
  });
});
