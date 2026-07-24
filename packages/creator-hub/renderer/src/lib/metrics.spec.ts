import { beforeEach, describe, expect, it, vi } from 'vitest';
import prd from '/@/config/env/prd.json';
import dev from '/@/config/env/dev.json';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('decentraland-crypto-fetch', () => ({
  default: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: () => ({ authChain: [], expiration: new Date(), ephemeralIdentity: {} }),
}));

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      key === 'METRICS_API_URL' ? 'https://decentraland.org/creators-data/api' : '',
  },
}));

describe('Metrics client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ address: '0xabc', as_of: '2026-07-21', scenes: [] }),
    });
  });

  it('pins both env configs at the creators-data mount', () => {
    expect(prd.METRICS_API_URL).toBe('https://decentraland.org/creators-data/api');
    expect(dev.METRICS_API_URL).toBe('https://decentraland.zone/creators-data/api');
  });

  it('signs a GET to <creators-data base>/creators/me/scenes/stats with no double /api', async () => {
    const { Metrics } = await import('./metrics');
    await new Metrics().fetchCreatorScenesStats('0xabc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; identity: unknown }];
    expect(url).toBe('https://decentraland.org/creators-data/api/creators/me/scenes/stats');
    expect(url).not.toContain('/api/api');
    expect(init.method).toBe('GET');
    expect(init.identity).toBeDefined();
  });
});
