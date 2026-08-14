import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MetricsWindow, SortBy } from '../../../../../shared/types/place-analytics';
import { AuthServerProvider } from '../../../lib/auth';
import type { AnalyticsPlace } from '../../../lib/analyticsLocations';
import type { LocationMetrics } from '../../../lib/metricsApi';
import { fetchAnalytics as fetchAnalyticsSnapshot } from '../../../lib/placeAnalytics';
import { actions as managementActions, fetchAllManagedProjectsData } from '../management';
import { createTestStore } from '../../../../tests/utils/testStore';
import { actions, fetchAnalytics, initialState, selectors } from './slice';

const TEST_ADDRESS = '0x123abc';
const EXPORTED_AT = '2026-08-12T00:17:01.099Z';

const place = (placeId: string, name: string): AnalyticsPlace => ({
  placeId,
  name,
  thumbnail: 'thumb.png',
  location: { world: name, x: 0, y: 0 },
  publishedIn: name,
  lastUpdatedAt: null,
});

const withVisits = (visits: number): LocationMetrics =>
  ({
    location_key: 'unused',
    x: 0,
    y: 0,
    builder_project_id: null,
    metrics: { unique_visits_60d: [{ series: 'all', period: null, value: visits }] },
  }) as LocationMetrics;

const EMPTY_METRICS: LocationMetrics = {
  location_key: 'unused',
  x: 0,
  y: 0,
  builder_project_id: null,
  metrics: {},
} as LocationMetrics;

const BANANARAMA = place('world:bananarama.dcl.eth@0,0', 'bananarama.dcl.eth');
const NIGHTMARE = place('world:nightmare.dcl.eth@0,0', 'nightmare.dcl.eth');

const SNAPSHOT = {
  exportedAt: EXPORTED_AT,
  places: [BANANARAMA, NIGHTMARE],
  metricsByPlaceId: {
    [BANANARAMA.placeId]: withVisits(2000),
    [NIGHTMARE.placeId]: withVisits(500),
  },
};

vi.mock('../../../lib/placeAnalytics', () => ({ fetchAnalytics: vi.fn() }));

vi.mock('../../../lib/auth', () => ({
  AuthServerProvider: { getAccount: vi.fn() },
}));

vi.mock('/@/modules/store/management', async () => {
  const actual = await import('../management');
  return { ...actual, fetchAllManagedProjectsData: vi.fn() };
});

/**
 * Stands in for dispatching the management thunk: RTK hands back a promise
 * carrying `unwrap`, which is what the slice awaits.
 */
const managedProjects = (outcome: Promise<unknown[]>) => () => {
  const dispatched = outcome as Promise<unknown[]> & { unwrap: () => Promise<unknown[]> };
  dispatched.unwrap = () => outcome;
  return dispatched;
};

describe('placeAnalytics slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-applied per test: `clearAllMocks` resets calls, not implementations.
    vi.mocked(fetchAllManagedProjectsData).mockImplementation((() =>
      managedProjects(Promise.resolve([]))) as any);
    store = createTestStore();
  });

  describe('when fetching analytics with a connected account', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
    });

    it('should store the snapshot and mark the request as succeeded', async () => {
      await store.dispatch(fetchAnalytics());

      expect(store.getState().placeAnalytics).toEqual({
        ...initialState,
        exportedAt: EXPORTED_AT,
        places: SNAPSHOT.places,
        metricsByPlaceId: SNAPSHOT.metricsByPlaceId,
        status: 'succeeded',
      });
    });

    it('should ask for every scene in one call rather than one call per tab', async () => {
      await store.dispatch(fetchAnalytics());

      expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the creator has no scenes', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue({
        exportedAt: '',
        places: [],
        metricsByPlaceId: {},
      });
    });

    it('should succeed with an empty list rather than failing', async () => {
      await store.dispatch(fetchAnalytics());

      const { places, status } = store.getState().placeAnalytics;
      expect(places).toEqual([]);
      expect(status).toBe('succeeded');
    });
  });

  describe('when fetching analytics without a connected account', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(undefined as any);
    });

    it('should fail without requesting anything', async () => {
      await store.dispatch(fetchAnalytics());

      expect(fetchAnalyticsSnapshot).not.toHaveBeenCalled();
      expect(store.getState().placeAnalytics.status).toBe('failed');
    });
  });

  describe('when the request fails', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockRejectedValue(
        new Error('locations[3]: "Not A Name" is not a valid ENS name'),
      );
    });

    it('should keep the message the service gave, so the page can show it', async () => {
      await store.dispatch(fetchAnalytics());

      const { status, error } = store.getState().placeAnalytics;
      expect(status).toBe('failed');
      expect(error).toMatch(/is not a valid ENS name/);
    });
  });

  describe('when management data is already in some other state', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
    });

    /*
     * `management.status` is written by two thunks, one nested in the other, and
     * `fetchManagedProjectsFiltered` sets it while honouring pagination. So no
     * value of it proves the project list is complete, and analytics has to load
     * the list itself rather than trust the flag.
     */
    it.each([
      ['loading', 'pending'],
      ['succeeded', 'fulfilled'],
      ['failed', 'rejected'],
    ])('should still load the project list when management is %s', async (_status, lifecycle) => {
      store.dispatch({
        type: `management/fetchAllManagedProjectsData/${lifecycle}`,
        payload: [],
        error: { message: 'whatever management did' },
      });

      await store.dispatch(fetchAnalytics());

      expect(fetchAllManagedProjectsData).toHaveBeenCalledWith({ address: TEST_ADDRESS });
    });
  });

  describe('when loading the project list fails', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      const failed = Promise.reject<unknown[]>(new Error('could not load your scenes'));
      failed.catch(() => {}); // the slice awaits `unwrap`, not this promise
      vi.mocked(fetchAllManagedProjectsData).mockImplementation((() =>
        managedProjects(failed)) as any);
    });

    it('should fail rather than report an empty list of places', async () => {
      await store.dispatch(fetchAnalytics());

      const { status, places, error } = store.getState().placeAnalytics;
      expect(status).toBe('failed');
      expect(places).toEqual([]);
      expect(error).toMatch(/could not load your scenes/);
      expect(fetchAnalyticsSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('when the account is disconnected', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
      await store.dispatch(fetchAnalytics());
    });

    it('should drop the previous account analytics', async () => {
      expect(store.getState().placeAnalytics.places).not.toEqual([]);

      store.dispatch(managementActions.clearState());

      expect(store.getState().placeAnalytics).toEqual(initialState);
    });
  });

  describe('when reading the visible places', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
      await store.dispatch(fetchAnalytics());
    });

    it('should project each scene into a summary row', () => {
      const [first] = selectors.getVisiblePlaces(store.getState());

      expect(first).toMatchObject({ placeId: BANANARAMA.placeId, name: BANANARAMA.name });
    });

    it('should apply the selected sorting', () => {
      store.dispatch(actions.setSortBy(SortBy.NAME_DESC));

      expect(selectors.getVisiblePlaces(store.getState()).map(p => p.name)).toEqual([
        NIGHTMARE.name,
        BANANARAMA.name,
      ]);
    });

    it('should sort on visits, which come from the visits metric', () => {
      store.dispatch(actions.setSortBy(SortBy.MOST_VISITS));

      expect(selectors.getVisiblePlaces(store.getState()).map(p => p.totalVisits)).toEqual([
        2000, 500,
      ]);
    });

    it('should apply the search query', () => {
      store.dispatch(actions.setSearchQuery('night'));

      expect(selectors.getVisiblePlaces(store.getState()).map(p => p.name)).toEqual([
        NIGHTMARE.name,
      ]);
    });

    it('should list pinned places first', () => {
      store.dispatch(actions.togglePinnedPlace(NIGHTMARE.placeId));

      expect(selectors.getVisiblePlaces(store.getState())[0].name).toBe(NIGHTMARE.name);
    });
  });

  describe('when the window changes', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
      await store.dispatch(fetchAnalytics());
    });

    it('should re-read the same snapshot rather than fetching again', () => {
      store.dispatch(actions.setWindow(MetricsWindow.LAST_30_DAYS));

      expect(store.getState().placeAnalytics.window).toBe(MetricsWindow.LAST_30_DAYS);
      expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    });

    it('should leave a scalar empty when the other window is the one that has it', () => {
      store.dispatch(actions.setWindow(MetricsWindow.LAST_30_DAYS));

      // The fixture only carries the 60-day metric, so the 30-day read is null.
      expect(selectors.getVisiblePlaces(store.getState())[0].totalVisits).toBeNull();
    });
  });

  describe('when a scene has no metrics at all', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue({
        exportedAt: EXPORTED_AT,
        places: [BANANARAMA],
        metricsByPlaceId: { [BANANARAMA.placeId]: EMPTY_METRICS },
      });
      await store.dispatch(fetchAnalytics());
    });

    it('should keep it in the list, flagged rather than dropped or failed', () => {
      const [row] = selectors.getVisiblePlaces(store.getState());

      expect(row.hasNoData).toBe(true);
      expect(store.getState().placeAnalytics.status).toBe('succeeded');
    });

    it('should still surface the export stamp', () => {
      expect(store.getState().placeAnalytics.exportedAt).toBe(EXPORTED_AT);
    });
  });

  describe('when reading one scene', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue(SNAPSHOT);
      await store.dispatch(fetchAnalytics());
    });

    it('should find it by our own id', () => {
      expect(selectors.getPlace(store.getState(), BANANARAMA.placeId)).toEqual(BANANARAMA);
      expect(selectors.getPlaceMetrics(store.getState(), BANANARAMA.placeId)).toEqual(
        SNAPSHOT.metricsByPlaceId[BANANARAMA.placeId],
      );
    });

    it('should return nothing for a scene that is not in the snapshot', () => {
      expect(selectors.getPlace(store.getState(), 'land:99,99')).toBeUndefined();
      expect(selectors.getPlaceMetrics(store.getState(), 'land:99,99')).toBeUndefined();
    });
  });
});
