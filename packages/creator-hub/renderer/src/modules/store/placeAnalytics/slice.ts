import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Async, Status } from '/shared/types/async';
import type {
  PlaceAnalyticsDetail,
  PlaceAnalyticsSummary,
  PlaceRetentionMetrics,
} from '/shared/types/place-analytics';
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
 * Data that belongs to one Place and loads independently of the list, so it
 * carries both the Place it describes and its own status.
 */
export type PlaceScopedState<T> = {
  placeId: string | null;
  data: T | null;
  status: Status;
  error: string | null;
};

const idle = <T>(): PlaceScopedState<T> => ({
  placeId: null,
  data: null,
  status: 'idle',
  error: null,
});

/**
 * Keeps the current data only while the same Place reloads. Switching Places
 * clears it, so one Place's numbers can never be read as another's.
 */
function loading<T>(state: PlaceScopedState<T>, placeId: string): PlaceScopedState<T> {
  return state.placeId === placeId
    ? { ...state, status: 'loading', error: null }
    : { placeId, data: null, status: 'loading', error: null };
}

const loaded = <T>(placeId: string, data: T): PlaceScopedState<T> => ({
  placeId,
  data,
  status: 'succeeded',
  error: null,
});

const failed = <T>(placeId: string, error: string): PlaceScopedState<T> => ({
  placeId,
  data: null,
  status: 'failed',
  error,
});

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

/** Retention metrics of a single Place, loaded when that tab is opened. */
export const fetchPlaceRetention = createAsyncThunk(
  'placeAnalytics/fetchPlaceRetention',
  async ({ placeId }: { placeId: string }, { getState }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const { dateRange } = getState().placeAnalytics;
    const PlaceAnalyticsAPI = new PlaceAnalytics();
    return PlaceAnalyticsAPI.fetchPlaceRetention(connectedAccount, placeId, dateRange);
  },
);

// state
export type PlaceAnalyticsState = {
  places: PlaceAnalyticsSummary[];
  detail: PlaceScopedState<PlaceAnalyticsDetail>;
  retention: PlaceScopedState<PlaceRetentionMetrics>;
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
  detail: idle(),
  retention: idle(),
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
      state.retention = initialState.retention;
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
        state.detail = loading(state.detail, action.meta.arg.placeId);
      })
      .addCase(fetchPlaceDetail.fulfilled, (state, action) => {
        state.detail = loaded(action.meta.arg.placeId, action.payload);
      })
      .addCase(fetchPlaceDetail.rejected, (state, action) => {
        state.detail = failed(
          action.meta.arg.placeId,
          action.error.message || 'Failed to fetch place analytics',
        );
      })
      .addCase(fetchPlaceRetention.pending, (state, action) => {
        state.retention = loading(state.retention, action.meta.arg.placeId);
      })
      .addCase(fetchPlaceRetention.fulfilled, (state, action) => {
        state.retention = loaded(action.meta.arg.placeId, action.payload);
      })
      .addCase(fetchPlaceRetention.rejected, (state, action) => {
        state.retention = failed(
          action.meta.arg.placeId,
          action.error.message || 'Failed to fetch place retention',
        );
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
export const actions = {
  ...slice.actions,
  fetchPlaces,
  fetchPlaceDetail,
  fetchPlaceRetention,
};
export const reducer = slice.reducer;
