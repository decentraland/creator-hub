import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { metrics } from '#preload';
import { fetchMetrics } from '/@/lib/metricsApi';
import { toOverview, toRetention, toVisits } from '/@/lib/placeAnalytics.adapter';
import { Worlds } from '/@/lib/worlds';
import { MetricsWindow } from '/shared/types/place-analytics';

import { demoMetricsBatch, demoWorldScenes, demoWorlds } from './demo';
import { setDemoDataOn } from './preferences';

const ADDRESS = '0x1234567890123456789012345678901234567890';

/** The Worlds client fetches through this; route it to the stubbed global so both cases are seen. */
vi.mock('decentraland-crypto-fetch', () => ({
  default: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
  signedHeaderFactory: () => () => new Map([['x-identity-auth-chain-0', 'stub']]),
}));

describe('demoWorlds', () => {
  it('should list the demo Worlds as owned by the asking wallet', () => {
    const { worlds, total } = demoWorlds({ authorized_deployer: ADDRESS });

    expect(total).toBeGreaterThan(0);
    expect(worlds.every(world => world.owner === ADDRESS)).toBe(true);
  });

  it('should answer the Manage page query: search, sort and page', () => {
    const page = demoWorlds({
      authorized_deployer: ADDRESS,
      search: 'a',
      sort: 'name',
      order: 'asc',
      limit: 2,
      offset: 0,
    });

    expect(page.worlds).toHaveLength(2);
    expect(page.worlds.every(world => world.name.includes('a'))).toBe(true);
    expect(page.worlds[0].name.localeCompare(page.worlds[1].name)).toBeLessThan(0);
  });
});

describe('demoWorldScenes', () => {
  it('should leave every non-demo World to the real server', () => {
    expect(demoWorldScenes('someone-elses.dcl.eth')).toBeNull();
  });
});

describe('demoMetricsBatch', () => {
  const location = { world: 'bananarama.dcl.eth', x: 0, y: 0 };

  it('should read through the real adapter as a full set of analytics', () => {
    const [scene] = demoMetricsBatch([location]).locations;
    const overview = toOverview(scene, MetricsWindow.LAST_60_DAYS);
    const retention = toRetention(scene, MetricsWindow.LAST_60_DAYS);

    expect(Object.values(overview).every(value => value !== null)).toBe(true);
    expect(overview.day7Retention).toBeGreaterThan(0);
    expect(overview.day7Retention).toBeLessThan(100);
    expect(retention.day7ByCohortWeek).toHaveLength(16);
    expect(toVisits(scene, MetricsWindow.LAST_30_DAYS).weeklyActiveUsers).toHaveLength(16);
  });

  it('should answer positionally, like the service', () => {
    const second = { world: 'skyrace.dcl.eth', x: 0, y: 0 };
    const { locations } = demoMetricsBatch([location, second]);

    expect(locations.map(({ world }) => world)).toEqual([location.world, second.world]);
  });
});

describe('the clients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when demo data is on', () => {
    beforeEach(() => {
      setDemoDataOn(true);
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should answer a creator’s Worlds and metrics without the network', async () => {
      const worlds = await new Worlds().fetchWorlds({ authorized_deployer: ADDRESS });
      const batch = await fetchMetrics([{ world: 'bananarama.dcl.eth', x: 0, y: 0 }]);

      expect(worlds?.total).toBeGreaterThan(0);
      expect(batch.locations).toHaveLength(1);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(metrics.request).not.toHaveBeenCalled();
    });
  });

  describe('when demo data is off', () => {
    beforeEach(() => {
      setDemoDataOn(false);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ worlds: [], total: 0 }), { status: 200 })),
      );
    });

    it('should ask the Worlds server as before', async () => {
      await new Worlds().fetchWorlds({ authorized_deployer: ADDRESS });

      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
