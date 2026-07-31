import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Async, Status } from '/shared/types/async';
import type { PlaceAnalyticsDetail, PlaceAnalyticsSummary } from '/shared/types/place-analytics';
import { DateRange, SortBy } from '/shared/types/place-analytics';

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

/**
 * Detail of the Place currently being looked at. Carries its own status because
 * it loads independently of the list.
 */
export type PlaceDetailState = {
  placeId: string | null;
  data: PlaceAnalyticsDetail | null;
  status: Status;
  error: string | null;
};

/** Analytics of a single Place for the selected date range. */
export const fetchPlaceDetail = createAsyncThunk(
  'placeAnalytics/fetchPlaceDetail',
  async ({ placeId }: { placeId: string }, { getState }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const { dateRange } = getState().placeAnalytics;
    const PlaceAnalyticsAPI = new PlaceAnalytics();
    return PlaceAnalyticsAPI.fetchPlaceDetail(connectedAccount, placeId, dateRange);
  },
);

// state
export type PlaceAnalyticsState = {
  places: PlaceAnalyticsSummary[];
  detail: PlaceDetailState;
  dateRange: DateRange;
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
  detail: { placeId: null, data: null, status: 'idle', error: null },
  dateRange: DateRange.LAST_7_DAYS,
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
    setDateRange: (state, action: PayloadAction<DateRange>) => {
      state.dateRange = action.payload;
    },
    clearDetail: state => {
      state.detail = initialState.detail;
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
      })
      .addCase(fetchPlaceDetail.pending, (state, action) => {
        // Drop the previous Place's data so its numbers can't be read as this one's.
        const placeId = action.meta.arg.placeId;
        state.detail =
          state.detail.placeId === placeId
            ? { ...state.detail, status: 'loading', error: null }
            : { placeId, data: null, status: 'loading', error: null };
      })
      .addCase(fetchPlaceDetail.fulfilled, (state, action) => {
        state.detail = {
          placeId: action.meta.arg.placeId,
          data: action.payload,
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(fetchPlaceDetail.rejected, (state, action) => {
        state.detail = {
          placeId: action.meta.arg.placeId,
          data: null,
          status: 'failed',
          error: action.error.message || 'Failed to fetch place analytics',
        };
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
export const actions = { ...slice.actions, fetchPlaces, fetchPlaceDetail };
export const reducer = slice.reducer;
