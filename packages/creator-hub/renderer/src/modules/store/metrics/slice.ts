import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { Async } from '/shared/types/async';
import type { SceneStats, SceneType } from '/shared/types/metrics';
import { Metrics } from '/@/lib/metrics';
import { createAsyncThunk } from '/@/modules/store/thunk';
import type { AppState } from '/@/modules/store';
import type { MetricsState } from './types';

export const initialState: Async<MetricsState> = {
  address: null,
  asOf: null,
  scenes: [],
  status: 'idle',
  error: null,
};

export const fetchCreatorScenesStats = createAsyncThunk(
  'metrics/fetchCreatorScenesStats',
  async ({ address }: { address: string }) => {
    const MetricsAPI = new Metrics();
    return MetricsAPI.fetchCreatorScenesStats(address);
  },
);

const slice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    clearState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchCreatorScenesStats.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCreatorScenesStats.fulfilled, (state, action) => {
        state.address = action.payload.address;
        state.asOf = action.payload.asOf;
        state.scenes = action.payload.scenes;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchCreatorScenesStats.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch scene metrics';
      });
  },
});

const getMetricsState = (state: AppState) => state.metrics;
const getScenes = createSelector(getMetricsState, metricsState => metricsState.scenes);
const getAsOf = createSelector(getMetricsState, metricsState => metricsState.asOf);

const getScene = (state: AppState, sceneType: SceneType, sceneId: string): SceneStats | undefined =>
  state.metrics.scenes.find(scene => scene.sceneType === sceneType && scene.sceneId === sceneId);

export const actions = {
  ...slice.actions,
  fetchCreatorScenesStats,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getMetricsState,
  getScenes,
  getAsOf,
  getScene,
};
