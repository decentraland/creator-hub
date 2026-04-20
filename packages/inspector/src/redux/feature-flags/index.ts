import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { InspectorFeatureFlags } from './types';

export interface FeatureFlagsState {
  flags: Record<string, boolean>;
}

export const initialState: FeatureFlagsState = {
  flags: {
    viewportToolbar: true,
    [InspectorFeatureFlags.RealSkybox]: true,
    [InspectorFeatureFlags.RealGround]: true,
    [InspectorFeatureFlags.FloorGrid]: true,
  },
};

export const featureFlags = createSlice({
  name: 'feature-flags',
  initialState,
  reducers: {
    setFeatureFlags: (state, { payload }: PayloadAction<Record<string, boolean>>) => {
      state.flags = payload;
    },
    toggleFeatureFlag: (state, { payload }: PayloadAction<string>) => {
      state.flags[payload] = !state.flags[payload];
    },
  },
});

// Actions
export const { setFeatureFlags, toggleFeatureFlag } = featureFlags.actions;

// Selectors
export const getFeatureFlags = (state: RootState): Record<string, boolean> =>
  state.featureFlags.flags;
export const isFeatureFlagEnabled = (state: RootState, flag: string): boolean =>
  !!state.featureFlags.flags[flag];

// Reducer
export default featureFlags.reducer;
