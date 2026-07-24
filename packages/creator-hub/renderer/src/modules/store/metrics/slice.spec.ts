import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestStore } from '../../../../tests/utils/testStore';
import {
  FIXTURE_AS_OF,
  creatorScenesStatsFixture,
  healthyGenesisScene,
  healthyWorldScene,
  maskedRetentionScene,
  zeroTrafficScene,
} from '../../../../tests/fixtures/metrics';
import { actions, fetchCreatorScenesStats, initialState, selectors } from './slice';
import {
  buildCsvRows,
  buildSocialSeries,
  dailyMeanDelta,
  isSeriesEmpty,
  retentionPoints,
  tailPoints,
  toCsv,
} from './utils';

const createMockMetricsAPI = () => ({
  fetchCreatorScenesStats: vi.fn(),
});

let mockMetricsAPI: ReturnType<typeof createMockMetricsAPI>;

vi.mock('/@/lib/metrics', () => ({
  METRICS_FEATURE_FLAG: 'creatorhub-creator-hub-metrics',
  isMetricsEnabled: (flags: Record<string, boolean>) => !!flags['creatorhub-creator-hub-metrics'],
  Metrics: class {
    constructor() {
      return mockMetricsAPI;
    }
  },
}));

describe('metrics slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    mockMetricsAPI = createMockMetricsAPI();
    store = createTestStore();
  });

  describe('when fetching creator scene stats', () => {
    describe('and the request succeeds', () => {
      beforeEach(() => {
        mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue(creatorScenesStatsFixture);
      });

      it('should store the snapshot and succeed', async () => {
        await store.dispatch(fetchCreatorScenesStats({ address: '0x123' }));
        const state = store.getState().metrics;
        expect(state.status).toBe('succeeded');
        expect(state.asOf).toBe(FIXTURE_AS_OF);
        expect(state.scenes).toHaveLength(4);
        expect(state.error).toBeNull();
      });
    });

    describe('and the request fails', () => {
      beforeEach(() => {
        mockMetricsAPI.fetchCreatorScenesStats.mockRejectedValue(new Error('boom'));
      });

      it('should fail with the error message', async () => {
        await store.dispatch(fetchCreatorScenesStats({ address: '0x123' }));
        const state = store.getState().metrics;
        expect(state.status).toBe('failed');
        expect(state.error).toBe('boom');
      });
    });

    describe('and the state is cleared afterwards', () => {
      beforeEach(() => {
        mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue(creatorScenesStatsFixture);
      });

      it('should reset to the initial state', async () => {
        await store.dispatch(fetchCreatorScenesStats({ address: '0x123' }));
        store.dispatch(actions.clearState());
        expect(store.getState().metrics).toEqual(initialState);
      });
    });
  });

  describe('selectors', () => {
    beforeEach(async () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue(creatorScenesStatsFixture);
      await store.dispatch(fetchCreatorScenesStats({ address: '0x123' }));
    });

    it('should look up a scene by type and id', () => {
      const state = store.getState() as any;
      expect(selectors.getScene(state, 'world', 'kickoff.dcl.eth')?.title).toBe('Kickoff');
      expect(selectors.getScene(state, 'genesis', 'nope')).toBeUndefined();
    });
  });
});

describe('toCsv', () => {
  it('should serialize the visible daily rows with the engagement columns', () => {
    const csv = toCsv(buildCsvRows([healthyWorldScene], FIXTURE_AS_OF, 7));
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'date,visits,unique_users,new_users,median_active_time_s,peak_concurrent_users,messages_sent,emotes_played',
    );
    expect(lines).toHaveLength(8);
    expect(lines[7]).toBe(`${FIXTURE_AS_OF},40,25,4,180,8,80,42`);
  });
});

describe('retentionPoints', () => {
  it('should project one horizon of the cohort curve, oldest first', () => {
    const points = retentionPoints(healthyGenesisScene, 'd7');
    expect(points).toHaveLength(90);
    expect(points[0].date < points[points.length - 1].date).toBe(true);
    expect(points.every(point => point.value !== null)).toBe(true);
  });

  it('should carry the data-layer mask through as nulls', () => {
    const points = retentionPoints(maskedRetentionScene, 'd1');
    expect(points.length).toBeGreaterThan(0);
    expect(isSeriesEmpty(points)).toBe(true);
  });

  it('should treat an empty series as masked', () => {
    expect(isSeriesEmpty(retentionPoints(zeroTrafficScene, 'd30'))).toBe(true);
  });
});

describe('tailPoints', () => {
  it('should keep only the most recent N points', () => {
    const tail = tailPoints(retentionPoints(healthyWorldScene, 'd7'), 7);
    expect(tail).toHaveLength(7);
    expect(tail[tail.length - 1].date).toBe(FIXTURE_AS_OF);
  });
});

describe('buildSocialSeries', () => {
  it('should sum messages and emotes per day across scenes', () => {
    const { messages, emotes } = buildSocialSeries(
      creatorScenesStatsFixture.scenes,
      FIXTURE_AS_OF,
      7,
    );
    expect(messages).toHaveLength(7);
    expect(messages.every(point => point.value === 110 + 2 + 80)).toBe(true);
    expect(emotes.every(point => point.value === 55 + 1 + 42)).toBe(true);
  });

  it('should zero-fill days with no traffic', () => {
    const { messages } = buildSocialSeries([zeroTrafficScene], FIXTURE_AS_OF, 7);
    expect(messages.every(point => point.value === 0)).toBe(true);
  });
});

describe('dailyMeanDelta', () => {
  it('should be null when there is no prior window to compare', () => {
    expect(
      dailyMeanDelta([healthyGenesisScene], FIXTURE_AS_OF, 90, row => row.medianActiveTimeS),
    ).toBeNull();
  });

  it('should be zero when the daily field is flat across both windows', () => {
    expect(
      dailyMeanDelta([healthyGenesisScene], FIXTURE_AS_OF, 7, row => row.medianActiveTimeS),
    ).toBe(0);
  });
});
