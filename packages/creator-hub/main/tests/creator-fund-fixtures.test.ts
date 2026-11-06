import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getApiUrlOverrides,
  startCreatorFundFixtures,
  stopCreatorFundFixtures,
} from '../src/modules/creator-fund-fixtures';
import { request } from '../src/modules/metrics';

const cyclesAt = (origin: string) =>
  request<{ cycles: { status: string }[] }>({
    baseUrl: origin,
    path: '/v3/creator-fund/cycles',
    method: 'GET',
  });

describe('Creator Fund fixtures', () => {
  afterEach(async () => {
    await stopCreatorFundFixtures();
    vi.unstubAllEnvs();
  });

  describe('when CREATOR_FUND_FIXTURES is not set', () => {
    it('should serve the fixtures and point the API URLs at them', async () => {
      const origin = await startCreatorFundFixtures({});

      expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/);
      expect(getApiUrlOverrides({})).toMatchObject({ CREATOR_FUND_API_URL: origin });
    });
  });

  describe('when CREATOR_FUND_FIXTURES=0', () => {
    it('should start no server and leave the API URLs alone', async () => {
      vi.stubEnv('DEV', false);

      expect(await startCreatorFundFixtures({ CREATOR_FUND_FIXTURES: '0' })).toBeNull();
      expect(getApiUrlOverrides({})).toEqual({});
    });
  });

  describe('when CREATOR_FUND_FIXTURES=1', () => {
    it('should serve the fixtures on a free 127.0.0.1 port and point the API URLs at it', async () => {
      const origin = await startCreatorFundFixtures({ CREATOR_FUND_FIXTURES: '1' });

      expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/);
      expect(getApiUrlOverrides({})).toEqual({
        CREATOR_FUND_API_URL: origin,
        METRICS_API_URL: `${origin}/v2`,
        WORLDS_CONTENT_SERVER_URL: origin,
      });
      const cycles = await cyclesAt(origin!);
      expect(cycles.ok && cycles.data.cycles.length).toBeGreaterThan(0);
    });

    it('should apply the MOCK_* switches', async () => {
      const origin = await startCreatorFundFixtures({
        CREATOR_FUND_FIXTURES: '1',
        MOCK_NO_RUNNING: '1',
      });

      const cycles = await cyclesAt(origin!);
      expect(cycles.ok && cycles.data.cycles.map(cycle => cycle.status)).toEqual(['upcoming']);
    });

    it('should stop serving once stopped, and override nothing after', async () => {
      vi.stubEnv('DEV', false);
      const origin = await startCreatorFundFixtures({ CREATOR_FUND_FIXTURES: '1' });

      await stopCreatorFundFixtures();

      expect((await cyclesAt(origin!)).ok).toBe(false);
      expect(getApiUrlOverrides({})).toEqual({});
    });
  });

  describe('when no fixtures run and the environment names an API URL', () => {
    const env = { CREATOR_FUND_API_URL: 'http://localhost:8787', PEER_URL: 'http://localhost:1' };

    it('should use it in a dev build, for that key only', () => {
      vi.stubEnv('DEV', true);

      expect(getApiUrlOverrides(env)).toEqual({ CREATOR_FUND_API_URL: 'http://localhost:8787' });
    });

    it('should ignore it in a release build', () => {
      vi.stubEnv('DEV', false);

      expect(getApiUrlOverrides(env)).toEqual({});
    });
  });
});
