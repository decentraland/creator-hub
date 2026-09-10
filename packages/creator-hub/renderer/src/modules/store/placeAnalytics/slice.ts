import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Async } from '/shared/types/async';
import { MetricsWindow, SortBy } from '/shared/types/place-analytics';

import { AuthServerProvider } from '/@/lib/auth';
import type { AnalyticsPlace } from '/@/lib/analyticsLocations';
import type { LocationMetrics } from '/@/lib/metricsApi';
import { toSummary } from '/@/lib/placeAnalytics.adapter';
import { fetchAnalytics as fetchAnalyticsSnapshot } from '/@/lib/placeAnalytics';
import { Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchLandList } from '/@/modules/store/land';
import { fetchAllDeployedWorlds } from '/@/modules/store/management/utils';
import { createAsyncThunk } from '/@/modules/store/thunk';

import { sortPlaces } from './utils';

/**
 * Analytics for every scene the connected account owns or collaborates on.
 *
 * One batched request answers the whole feature — the list and every tab of the
 * detail page — so this is the only thunk. Switching window or opening a scene
 * re-reads the same snapshot rather than fetching again.
 *
 * The scenes to ask about are fetched here rather than read out of the
 * management slice: that slice holds the Manage page's own list, narrowed by its
 * search box, filter and page, so borrowing it makes this list silently inherit
 * a view the creator set somewhere else.
 *
 * Skipped while one is already running: a second run would rebuild the list from
 * whatever the store held when it started, and the slower one wins.
 */
export const fetchAnalytics = createAsyncThunk(
  'placeAnalytics/fetchAnalytics',
  async (_: void, { dispatch }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const [projects, { land }] = await Promise.all([
      fetchAllDeployedWorlds(new Worlds(), connectedAccount),
      dispatch(fetchLandList({ address: connectedAccount })).unwrap(),
    ]);

    return fetchAnalyticsSnapshot(projects, land);
  },
  {
    condition: (_: void, { getState }) =>
      (getState() as AppState).placeAnalytics.status !== 'loading',
  },
);

// state
export type PlaceAnalyticsState = {
  /** The warehouse's export stamp, shown as an "as of" date. */
  exportedAt: string;
  places: AnalyticsPlace[];
  metricsByPlaceId: Record<string, LocationMetrics>;
  /** Which trailing window the scalar metrics are read over. */
  window: MetricsWindow;
  sortBy: SortBy;
  searchQuery: string;
  /**
   * Places pinned to the watchlist, shown first in the list. Kept in memory
   * until we know where a watchlist should be persisted.
   */
  pinnedPlaceIds: string[];
};

export const initialState: Async<PlaceAnalyticsState> = {
  exportedAt: '',
  places: [],
  metricsByPlaceId: {},
  window: MetricsWindow.LAST_60_DAYS,
  sortBy: SortBy.NAME_ASC,
  searchQuery: '',
  pinnedPlaceIds: [],
  status: 'idle',
  error: null,
};

// slice
const slice = createSlice({
  name: 'placeAnalytics',
  initialState,
  reducers: {
    setSortBy: (state, action: PayloadAction<SortBy>) => {
      state.sortBy = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setWindow: (state, action: PayloadAction<MetricsWindow>) => {
      state.window = action.payload;
    },
    togglePinnedPlace: (state, action: PayloadAction<string>) => {
      const placeId = action.payload;
      state.pinnedPlaceIds = state.pinnedPlaceIds.includes(placeId)
        ? state.pinnedPlaceIds.filter($ => $ !== placeId)
        : [...state.pinnedPlaceIds, placeId];
    },
    clearState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAnalytics.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.exportedAt = action.payload.exportedAt;
        state.places = action.payload.places;
        state.metricsByPlaceId = action.payload.metricsByPlaceId;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch analytics';
      });
  },
});

const getPlaceAnalyticsState = (state: AppState) => state.placeAnalytics;

/**
 * Places to render: matching the search query, pinned ones first, then sorted.
 *
 * The whole list arrives in one response, so filtering and sorting happen here.
 */
const getVisiblePlaces = createSelector(getPlaceAnalyticsState, analytics =>
  sortPlaces(
    analytics.places.flatMap(place => {
      const metrics = analytics.metricsByPlaceId[place.placeId];
      return metrics ? [toSummary(metrics, analytics.window, place)] : [];
    }),
    analytics.searchQuery,
    analytics.sortBy,
    analytics.pinnedPlaceIds,
  ),
);

/** The metrics for one scene, or `undefined` if it is not in the snapshot. */
export const getPlaceMetrics = (state: AppState, placeId: string): LocationMetrics | undefined =>
  state.placeAnalytics.metricsByPlaceId[placeId];

export const getPlace = (state: AppState, placeId: string): AnalyticsPlace | undefined =>
  state.placeAnalytics.places.find(place => place.placeId === placeId);

export const selectors = { getVisiblePlaces, getPlaceMetrics, getPlace };
export const actions = { ...slice.actions, fetchAnalytics };
export const reducer = slice.reducer;
