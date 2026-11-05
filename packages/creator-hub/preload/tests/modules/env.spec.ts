import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcRenderer: { sendSync: vi.fn() } }));

const { getApiUrlOverrides } = await import('../../src/modules/env');

describe('getApiUrlOverrides', () => {
  beforeEach(() => {
    vi.stubEnv('CREATOR_FUND_API_URL', 'http://localhost:8788');
    vi.stubEnv('METRICS_API_URL', 'http://localhost:8788/v2');
    vi.stubEnv('WORLDS_CONTENT_SERVER_URL', '');
    vi.stubEnv('PEER_URL', 'http://localhost:9999');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('when the build is a dev build', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('should return the API base URLs set in the environment, and nothing else', () => {
      expect(getApiUrlOverrides()).toEqual({
        CREATOR_FUND_API_URL: 'http://localhost:8788',
        METRICS_API_URL: 'http://localhost:8788/v2',
      });
    });
  });

  describe('when the build is a release build', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', false);
    });

    it('should ignore the environment', () => {
      expect(getApiUrlOverrides()).toEqual({});
    });
  });
});
