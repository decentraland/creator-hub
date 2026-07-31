import { createSlice } from '@reduxjs/toolkit';

import type { Async } from '/shared/types/async';
import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';

import { AuthServerProvider } from '/@/lib/auth';
import { PlaceAnalytics } from '/@/lib/placeAnalytics';
import { createAsyncThunk } from '/@/modules/store/thunk';

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
};

export const initialState: Async<PlaceAnalyticsState> = {
  places: [],
  status: 'idle',
  error: null,
};

// slice
const slice = createSlice({
  name: 'placeAnalytics',
  initialState,
  reducers: {
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

export const actions = { ...slice.actions, fetchPlaces };
export const reducer = slice.reducer;
