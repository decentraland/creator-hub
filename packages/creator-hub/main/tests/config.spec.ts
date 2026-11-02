import { describe, expect, it, vi } from 'vitest';

import { getConfigStorage, getDefaultConfig } from '../src/modules/config';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  setAll: vi.fn(async () => {}),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/creator-hub-config-spec' },
  BrowserWindow: {},
  clipboard: {},
  dialog: {},
  shell: {},
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/modules/migrations', () => ({
  waitForMigrations: vi.fn(async () => {}),
}));

vi.mock('/shared/types/storage', () => ({
  FileSystemStorage: {
    getOrCreate: vi.fn(async () => ({ getAll: mocks.getAll, setAll: mocks.setAll })),
  },
}));

describe('when a stored config still carries the removed guiEditor setting', () => {
  it('should write the config back with the key stripped', async () => {
    const stored = getDefaultConfig();
    (stored.settings as Record<string, unknown>).guiEditor = false;
    mocks.getAll.mockResolvedValue(stored);

    await getConfigStorage();

    expect(mocks.setAll).toHaveBeenCalledTimes(1);
    const written = mocks.setAll.mock.calls[0][0] as { settings: Record<string, unknown> };
    expect('guiEditor' in written.settings).toBe(false);

    const expected = getDefaultConfig();
    (expected.settings as Record<string, unknown>).aiAssistantPromoted = true;
    (expected.settings as Record<string, unknown>).debugConsolePromoted = true;
    expect(written).toEqual(expected);
  });
});
