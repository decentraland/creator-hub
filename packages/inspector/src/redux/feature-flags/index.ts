import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface FeatureFlagsState {
  flags: Record<string, boolean>;
}

export const initialState: FeatureFlagsState = {
  flags: {},
};

export const featureFlags = createSlice({
  name: 'feature-flags',
  initialState,
  reducers: {
    setFeatureFlags: (state, { payload }: PayloadAction<Record<string, boolean>>) => {
      state.flags = payload;
    },
  },
});

// Actions
export const { setFeatureFlags } = featureFlags.actions;

// Selectors
export const getFeatureFlags = (state: RootState): Record<string, boolean> =>
  state.featureFlags.flags;
export const isFeatureFlagEnabled = (state: RootState, flag: string): boolean =>
  !!state.featureFlags.flags[flag];

// Reducer
export default featureFlags.reducer;
