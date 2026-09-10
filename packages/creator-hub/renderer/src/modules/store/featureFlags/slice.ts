import { createSlice } from '@reduxjs/toolkit';
import { fetchFlags } from '@dcl/feature-flags';
import type { FeatureFlagsResult } from '@dcl/feature-flags';
import type { Status } from '/shared/types/async';
import { config } from '/@/config';
import { createAsyncThunk } from '../thunk';
import { applyFlagOverrides } from './overrides';

const APPLICATION_NAME = 'creatorhub';
// The abgen pipeline flag lives in the explorer's namespace, and both apps have to read the
// same one (see FeatureFlag.ABGEN_PIPELINE).
const APPLICATION_NAMES = [APPLICATION_NAME, 'explorer'];

export const fetchFeatureFlags = createAsyncThunk('featureFlags/fetch', async () => {
  const featureFlagsUrl = config.get('FEATURE_FLAGS_URL');

  // One request per namespace instead of one multi-namespace `fetchFlags` call: that one
  // discards every result as soon as any namespace fails, which would take this app's own
  // flags down with the explorer's.
  const results = await Promise.all(
    APPLICATION_NAMES.map(applicationName => fetchFlags({ applicationName, featureFlagsUrl })),
  );

  const merged = results.reduce<FeatureFlagsResult>(
    (acc, result) => ({
      flags: { ...acc.flags, ...result.flags },
      variants: { ...acc.variants, ...result.variants },
      error: acc.error ?? result.error,
    }),
    { flags: {}, variants: {} },
  );

  return { ...merged, flags: applyFlagOverrides(merged.flags) };
});

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
});

export const actions = { ...slice.actions, fetchFeatureFlags };
export const reducer = slice.reducer;
