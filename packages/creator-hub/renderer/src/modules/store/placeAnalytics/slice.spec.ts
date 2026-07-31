import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaceAnalyticsSummary } from '../../../../../shared/types/place-analytics';
import { SortBy } from '../../../../../shared/types/place-analytics';
import { AuthServerProvider } from '../../../lib/auth';
import { createTestStore } from '../../../../tests/utils/testStore';
import { actions, fetchPlaces, initialState, selectors } from './slice';

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

const mockPlaceAnalyticsAPI = {
  fetchPlaces: vi.fn(),
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
});
