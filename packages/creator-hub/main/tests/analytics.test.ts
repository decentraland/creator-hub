import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import log from 'electron-log';

import { trackLifecycleEvent } from '../src/modules/analytics';

const trackSpy = vi.fn();

vi.mock('@segment/analytics-node', () => ({
  Analytics: vi.fn().mockImplementation(() => ({
    track: trackSpy,
    identify: vi.fn(),
  })),
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@sentry/electron/main', () => ({ setUser: vi.fn() }));

vi.mock('../src/modules/electron', () => ({
  getWorkspaceConfigPath: vi.fn(),
}));

let configData: Record<string, unknown> = {};

const configStorage = {
  get: vi.fn(async (key: string) => configData[key]),
  set: vi.fn(async (key: string, value: unknown) => {
    configData[key] = value;
  }),
  getAll: vi.fn(async () => configData),
  setAll: vi.fn(async (data: Record<string, unknown>) => {
    configData = data;
  }),
  has: vi.fn(async (key: string) => key in configData),
};

vi.mock('../src/modules/config', () => ({
  getConfigStorage: vi.fn(async () => configStorage),
}));

describe('trackLifecycleEvent', () => {
  beforeEach(() => {
    configData = {};
    vi.clearAllMocks();
    // Provide a Segment write key so getAnalytics() returns the mocked client.
    vi.stubEnv('VITE_SEGMENT_CREATORS_HUB_API_KEY', 'test-write-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('when the config has no markers and no anonymous id (fresh install)', () => {
    it('should fire the Install Creator Hub event and persist the markers', async () => {
      await trackLifecycleEvent('1.2.0');

      expect(trackSpy).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'Install Creator Hub',
          properties: expect.objectContaining({ version: '1.2.0' }),
        }),
      );
      expect(typeof configData.installedAt).toBe('string');
      expect(configData.lastVersion).toBe('1.2.0');
    });
  });

  describe('when the config already has an anonymous id but no markers (pre-existing user)', () => {
    beforeEach(() => {
      configData = { userId: 'existing-anonymous-id' };
    });

    it('should not fire any event but backfill the markers', async () => {
      await trackLifecycleEvent('1.2.0');

      expect(trackSpy).not.toHaveBeenCalled();
      expect(typeof configData.installedAt).toBe('string');
      expect(configData.lastVersion).toBe('1.2.0');
    });
  });

  describe('when the last seen version matches the current version', () => {
    beforeEach(() => {
      configData = {
        userId: 'existing-anonymous-id',
        installedAt: '2020-01-01T00:00:00.000Z',
        lastVersion: '1.2.0',
      };
    });

    it('should not fire any event and leave installedAt untouched', async () => {
      await trackLifecycleEvent('1.2.0');

      expect(trackSpy).not.toHaveBeenCalled();
      expect(configData.installedAt).toBe('2020-01-01T00:00:00.000Z');
      expect(configData.lastVersion).toBe('1.2.0');
    });
  });

  describe('when the last seen version differs from the current version (update)', () => {
    beforeEach(() => {
      configData = {
        userId: 'existing-anonymous-id',
        installedAt: '2020-01-01T00:00:00.000Z',
        lastVersion: '1.1.0',
      };
    });

    it('should fire the Update Creator Hub event with the previous version and update lastVersion', async () => {
      await trackLifecycleEvent('1.2.0');

      expect(trackSpy).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'Update Creator Hub',
          properties: expect.objectContaining({
            version: '1.2.0',
            previous_version: '1.1.0',
          }),
        }),
      );
      expect(configData.installedAt).toBe('2020-01-01T00:00:00.000Z');
      expect(configData.lastVersion).toBe('1.2.0');
    });
  });

  describe('when reading the config fails', () => {
    it('should swallow the error and log it instead of throwing', async () => {
      configStorage.get.mockRejectedValueOnce(new Error('corrupt config'));

      await expect(trackLifecycleEvent('1.2.0')).resolves.toBeUndefined();
      expect(trackSpy).not.toHaveBeenCalled();
      expect(log.error).toHaveBeenCalledWith('Error tracking lifecycle event', expect.any(Error));
    });
  });
});
