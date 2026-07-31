import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PlaceAnalyticsDetail,
  PlaceAnalyticsSummary,
} from '../../../../../shared/types/place-analytics';
import { DateRange, PlaceAccess, SortBy } from '../../../../../shared/types/place-analytics';
import { AuthServerProvider } from '../../../lib/auth';
import { createTestStore } from '../../../../tests/utils/testStore';
import { actions, fetchPlaceDetail, fetchPlaces, initialState, selectors } from './slice';

const TEST_ADDRESS = '0x123abc';

const PLACE: PlaceAnalyticsSummary = {
  placeId: 'bananarama',
  name: 'Bananarama',
  thumbnail: 'bananarama-thumbnail.png',
  totalVisits: 2000,
  newUsers: 10,
  day7Retention: 35,
  revenue: 106.7,
  avgPlaytime: 95,
};

const DETAIL: PlaceAnalyticsDetail = {
  place: {
    placeId: 'bananarama',
    name: 'Bananarama',
    thumbnail: 'bananarama-thumbnail.png',
    likeRate: 87,
    access: PlaceAccess.PRIVATE,
    publishedIn: 'worldname',
    lastPublishedBy: { name: 'UserName', avatar: null },
    lastUpdatedAt: 1_796_000_000_000,
  },
  overview: {
    totalVisits: 2000,
    uniqueVisits: 324,
    newUsers: 10,
    concurrentUsers: 124,
    revenue: 106.7,
    day7Retention: 35,
    avgPlaytime: 95,
    afkTime: 12,
    desktopUsers: 124,
    mobileUsers: 14,
  },
};

const mockPlaceAnalyticsAPI = {
  fetchPlaces: vi.fn(),
  fetchPlaceDetail: vi.fn(),
};

vi.mock('/@/lib/placeAnalytics', () => ({
  PlaceAnalytics: class {
    constructor() {
      return mockPlaceAnalyticsAPI;
    }
  },
}));

vi.mock('/@/lib/auth', () => ({
  AuthServerProvider: {
    getAccount: vi.fn(),
  },
}));

describe('placeAnalytics slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  describe('when fetching places analytics with a connected account', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockPlaceAnalyticsAPI.fetchPlaces.mockResolvedValue([PLACE]);
    });

    it('should request the analytics of the connected account', async () => {
      await store.dispatch(fetchPlaces());

      expect(mockPlaceAnalyticsAPI.fetchPlaces).toHaveBeenCalledWith(TEST_ADDRESS);
    });

    it('should store the places and mark the request as succeeded', async () => {
      await store.dispatch(fetchPlaces());

      expect(store.getState().placeAnalytics).toEqual({
        ...initialState,
        places: [PLACE],
        status: 'succeeded',
      });
    });
  });

  describe('when the creator has no places with analytics', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockPlaceAnalyticsAPI.fetchPlaces.mockResolvedValue([]);
    });

    it('should succeed with an empty list', async () => {
      await store.dispatch(fetchPlaces());

      const { places, status } = store.getState().placeAnalytics;
      expect(places).toEqual([]);
      expect(status).toBe('succeeded');
    });
  });

  describe('when fetching places analytics without a connected account', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(null);
    });

    it('should fail without requesting any analytics', async () => {
      await store.dispatch(fetchPlaces());

      const { places, status, error } = store.getState().placeAnalytics;
      expect(mockPlaceAnalyticsAPI.fetchPlaces).not.toHaveBeenCalled();
      expect(places).toEqual([]);
      expect(status).toBe('failed');
      expect(error).toBe('No connected account found');
    });
  });

  describe('when pinning a place to the watchlist', () => {
    it('should add it to the pinned places', () => {
      store.dispatch(actions.togglePinnedPlace('bananarama'));

      expect(store.getState().placeAnalytics.pinnedPlaceIds).toEqual(['bananarama']);
    });

    it('should remove it when pinned again', () => {
      store.dispatch(actions.togglePinnedPlace('bananarama'));
      store.dispatch(actions.togglePinnedPlace('bananarama'));

      expect(store.getState().placeAnalytics.pinnedPlaceIds).toEqual([]);
    });

    it('should keep the other pinned places', () => {
      store.dispatch(actions.togglePinnedPlace('bananarama'));
      store.dispatch(actions.togglePinnedPlace('unmonday-club'));
      store.dispatch(actions.togglePinnedPlace('bananarama'));

      expect(store.getState().placeAnalytics.pinnedPlaceIds).toEqual(['unmonday-club']);
    });
  });

  describe('when reading the visible places', () => {
    const OTHER_PLACE = { ...PLACE, placeId: 'unmonday-club', name: 'Unmonday Club' };

    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockPlaceAnalyticsAPI.fetchPlaces.mockResolvedValue([OTHER_PLACE, PLACE]);
      await store.dispatch(fetchPlaces());
    });

    it('should apply the selected sorting', () => {
      store.dispatch(actions.setSortBy(SortBy.NAME_DESC));

      expect(selectors.getVisiblePlaces(store.getState() as any).map($ => $.name)).toEqual([
        'Unmonday Club',
        'Bananarama',
      ]);
    });

    it('should apply the search query', () => {
      store.dispatch(actions.setSearchQuery('banana'));

      expect(selectors.getVisiblePlaces(store.getState() as any).map($ => $.name)).toEqual([
        'Bananarama',
      ]);
    });

    it('should list pinned places first', () => {
      store.dispatch(actions.setSortBy(SortBy.NAME_ASC));
      store.dispatch(actions.togglePinnedPlace('unmonday-club'));

      expect(selectors.getVisiblePlaces(store.getState() as any).map($ => $.name)).toEqual([
        'Unmonday Club',
        'Bananarama',
      ]);
    });
  });

  describe('when fetching the detail of a place', () => {
    beforeEach(() => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockPlaceAnalyticsAPI.fetchPlaceDetail.mockResolvedValue(DETAIL);
    });

    it('should request it for the connected account and selected date range', async () => {
      store.dispatch(actions.setDateRange(DateRange.LAST_30_DAYS));
      await store.dispatch(fetchPlaceDetail({ placeId: 'bananarama' }));

      expect(mockPlaceAnalyticsAPI.fetchPlaceDetail).toHaveBeenCalledWith(
        TEST_ADDRESS,
        'bananarama',
        DateRange.LAST_30_DAYS,
      );
    });

    it('should store it against the place it belongs to', async () => {
      await store.dispatch(fetchPlaceDetail({ placeId: 'bananarama' }));

      expect(store.getState().placeAnalytics.detail).toEqual({
        placeId: 'bananarama',
        data: DETAIL,
        status: 'succeeded',
        error: null,
      });
    });

    it('should fail without keeping stale data when the place has no analytics', async () => {
      mockPlaceAnalyticsAPI.fetchPlaceDetail.mockRejectedValue(new Error('No analytics found'));
      await store.dispatch(fetchPlaceDetail({ placeId: 'ghost' }));

      expect(store.getState().placeAnalytics.detail).toEqual({
        placeId: 'ghost',
        data: null,
        status: 'failed',
        error: 'No analytics found',
      });
    });
  });

  describe('when opening a different place than the one already loaded', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockPlaceAnalyticsAPI.fetchPlaceDetail.mockResolvedValue(DETAIL);
      await store.dispatch(fetchPlaceDetail({ placeId: 'bananarama' }));
    });

    it('should drop the previous place data while the new one loads', () => {
      // Not awaited: the assertion is about the in-flight state.
      void store.dispatch(fetchPlaceDetail({ placeId: 'unmonday-club' }));

      const { detail } = store.getState().placeAnalytics;
      expect(detail.placeId).toBe('unmonday-club');
      expect(detail.data).toBeNull();
      expect(detail.status).toBe('loading');
    });

    it('should keep showing the data while refetching the same place', () => {
      void store.dispatch(fetchPlaceDetail({ placeId: 'bananarama' }));

      const { detail } = store.getState().placeAnalytics;
      expect(detail.data).toEqual(DETAIL);
      expect(detail.status).toBe('loading');
    });

    it('should reset the detail when leaving the page', () => {
      store.dispatch(actions.clearDetail());

      expect(store.getState().placeAnalytics.detail).toEqual(initialState.detail);
    });
  });
});
