import { analytics } from '#preload';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

// actions
export const fetchUserId = createAsyncThunk('analytics/fetchUserId', analytics.getUserId);

// state
export type AnalyticsState = {
  loading: boolean;
  userId: string | null;
  error: string | null;
};

const initialState: AnalyticsState = {
  loading: false,
  userId: null,
  error: null,
};

// selectors

// slice
export const slice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchUserId.pending, state => {
      state.loading = true;
    });
    builder.addCase(fetchUserId.fulfilled, (state, action) => {
      state.loading = false;
      state.userId = action.payload;
      state.error = null;
    });
    builder.addCase(fetchUserId.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || null;
    });
  },
});

// exports
export const actions = {
  ...slice.actions,
  fetchUserId,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
