import { createSlice } from '@reduxjs/toolkit';
import { fetchFlags } from '@dcl/feature-flags';
import type { FeatureFlagsResult } from '@dcl/feature-flags';
import type { Status } from '/shared/types/async';
import { createAsyncThunk } from '../thunk';

const APPLICATION_NAME = 'creator-hub';

export const fetchFeatureFlags = createAsyncThunk('featureFlags/fetch', () =>
  fetchFlags({ applicationName: APPLICATION_NAME }),
);

export type FeatureFlagsState = {
  flags: FeatureFlagsResult['flags'];
  variants: FeatureFlagsResult['variants'];
  status: Status;
  error: string | null;
};

const initialState: FeatureFlagsState = {
  flags: {},
  variants: {},
  status: 'idle',
  error: null,
};

const slice = createSlice({
  name: 'featureFlags',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchFeatureFlags.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchFeatureFlags.fulfilled, (state, action) => {
        state.flags = action.payload.flags;
        state.variants = action.payload.variants;
        state.status = 'succeeded';
        state.error = action.payload.error?.message ?? null;
      })
      .addCase(fetchFeatureFlags.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to fetch feature flags';
      });
  },
  selectors: {
    getFlags: state => state.flags,
    getVariants: state => state.variants,
    getStatus: state => state.status,
    isFeatureFlagEnabled: (state, flag: string) => !!state.flags[flag],
  },
});

export const actions = { ...slice.actions, fetchFeatureFlags };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
