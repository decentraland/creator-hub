import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Async } from '/shared/types/async';
import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';
import { SortBy } from '/shared/types/place-analytics';

import { AuthServerProvider } from '/@/lib/auth';
import { PlaceAnalytics } from '/@/lib/placeAnalytics';
import type { AppState } from '/@/modules/store';
import { createAsyncThunk } from '/@/modules/store/thunk';

import { sortPlaces } from './utils';

/** Analytics of the published Places owned by the connected account. */
export const fetchPlaces = createAsyncThunk('placeAnalytics/fetchPlaces', async () => {
  const connectedAccount = AuthServerProvider.getAccount();
  if (!connectedAccount) throw new Error('No connected account found');

  const PlaceAnalyticsAPI = new PlaceAnalytics();
  return PlaceAnalyticsAPI.fetchPlaces(connectedAccount);
});

// state
export type PlaceAnalyticsState = {
  places: PlaceAnalyticsSummary[];
  sortBy: SortBy;
  searchQuery: string;
  /**
   * Places pinned to the watchlist, shown first in the list. Kept in memory
   * until we know where a watchlist should be persisted.
   */
  pinnedPlaceIds: string[];
};

export const initialState: Async<PlaceAnalyticsState> = {
  places: [],
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
      .addCase(fetchPlaces.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPlaces.fulfilled, (state, action) => {
        state.places = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchPlaces.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch places analytics';
      });
  },
});

/**
 * Places to render: matching the search query, pinned ones first, then sorted.
 * Filtering and sorting happen here because the whole list comes in one
 * response — move them to the request if the API ever paginates.
 */
const getPlaceAnalyticsState = (state: AppState) => state.placeAnalytics;

const getVisiblePlaces = createSelector(getPlaceAnalyticsState, placeAnalyticsState =>
  sortPlaces(
    placeAnalyticsState.places,
    placeAnalyticsState.searchQuery,
    placeAnalyticsState.sortBy,
    placeAnalyticsState.pinnedPlaceIds,
  ),
);

export const selectors = { getVisiblePlaces };
export const actions = { ...slice.actions, fetchPlaces };
export const reducer = slice.reducer;
