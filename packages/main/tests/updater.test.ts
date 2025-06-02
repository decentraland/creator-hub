import { beforeEach, describe, expect, test, vi } from 'vitest';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo, UpdateCheckResult } from 'electron-updater';
import { checkForUpdates, setupUpdaterEvents } from '../src/modules/updater';

vi.mock('@sentry/electron/main', () => {
  const mockCaptureException = vi.fn();
  return {
    __esModule: true,
    captureException: mockCaptureException,
    default: { captureException: mockCaptureException },
  };
});

vi.mock('electron-log/main', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('electron-log/main')>();
  return {
    ...actual,
    default: {
      info: vi.fn(),
      error: vi.fn(),
    },
    info: vi.fn(),
    error: vi.fn(),
  };
});

vi.mock('electron-updater', () => {
  const autoUpdater = {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false,
    setFeedURL: vi.fn(),
    currentVersion: { version: '1.0.0' },
  };
  return {
    default: { autoUpdater },
    autoUpdater,
  };
});

describe('Updater Module', () => {
  const mockEvent = {
    sender: {
      send: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    autoUpdater.currentVersion.version = '3.4.0';
    vi.clearAllMocks();
  });

  describe('checkForUpdates', () => {
    test('should return updateAvailable true when a newer version is available', async () => {
      const updateInfo: UpdateInfo = {
        version: '5.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
      };
      const result: UpdateCheckResult = {
        updateInfo,
        versionInfo: updateInfo,
      };
      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce(result);

      const response = await checkForUpdates(mockEvent, { autoDownload: false });

      expect(response).toEqual({
        updateAvailable: true,
        version: '5.0.0',
      });
    });

    test('should return updateAvailable false when current version is the same as the latest version', async () => {
      const updateInfo: UpdateInfo = {
        version: '3.4.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
      };
      const result: UpdateCheckResult = {
        updateInfo,
        versionInfo: updateInfo,
      };
      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce(result);

      const response = await checkForUpdates(mockEvent, { autoDownload: false });

      expect(response).toEqual({
        updateAvailable: false,
        version: '3.4.0',
      });
    });

    test('should return updateAvailable false when received version is older than current', async () => {
      const updateInfo: UpdateInfo = {
        version: '2.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
      };

      const result: UpdateCheckResult = {
        updateInfo,
        versionInfo: updateInfo,
      };

      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce(result);

      const response = await checkForUpdates(mockEvent, { autoDownload: false });

      expect(response).toEqual({
        updateAvailable: false,
        version: '2.0.0',
      });
    });

    test('should handle errors and capture exception', async () => {
      const error = new Error('Update check failed');
      vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(error);

      await expect(checkForUpdates(mockEvent, { autoDownload: false })).rejects.toThrow(
        'Update check failed',
      );
    });

    test('should configure autoDownload to true when passed in config', async () => {
      const updateInfo: UpdateInfo = {
        version: '2.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
      };
      const result: UpdateCheckResult = {
        updateInfo,
        versionInfo: updateInfo,
      };

      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce(result);

      await checkForUpdates(mockEvent, { autoDownload: true });

      expect(autoUpdater.autoDownload).toBe(true);
    });

    test('setupUpdaterEvents registers all expected event handlers', () => {
      setupUpdaterEvents(mockEvent);

      const expectedEvents = [
        'checking-for-update',
        'update-available',
        'update-not-available',
        'update-downloaded',
        'download-progress',
        'error',
      ];

      expectedEvents.forEach(event =>
        expect(autoUpdater.on).toHaveBeenCalledWith(event, expect.any(Function)),
      );
    });
  });
});
