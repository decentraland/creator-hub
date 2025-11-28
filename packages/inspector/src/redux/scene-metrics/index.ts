import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { SceneMetrics } from './types';

export interface SceneMetricsState {
  metrics: SceneMetrics;
  limits: SceneMetrics;
  entitiesOutOfBoundaries: number[];
  hasCustomCode: boolean;
}

export const initialState: SceneMetricsState = {
  metrics: {
    triangles: 0,
    entities: 0,
    bodies: 0,
    materials: 0,
    textures: 0,
  },
  limits: {
    triangles: 0,
    entities: 0,
    bodies: 0,
    materials: 0,
    textures: 0,
  },
  entitiesOutOfBoundaries: [],
  hasCustomCode: false,
};

export const sceneMetrics = createSlice({
  name: 'scene-metrics',
  initialState,
  reducers: {
    setMetrics: (state, { payload }: PayloadAction<SceneMetrics>) => {
      state.metrics = payload;
    },
    setLimits(state, { payload }: PayloadAction<SceneMetrics>) {
      state.limits = payload;
    },
    setEntitiesOutOfBoundaries: (state, { payload }: PayloadAction<number[]>) => {
      state.entitiesOutOfBoundaries = payload;
    },
    setHasCustomCode: (state, { payload }: PayloadAction<boolean>) => {
      state.hasCustomCode = payload;
    },
  },
});

// Actions
export const { setMetrics, setEntitiesOutOfBoundaries, setLimits, setHasCustomCode } =
  sceneMetrics.actions;

// Selectors
export const getMetrics = (state: RootState): SceneMetrics => state.sceneMetrics.metrics;
export const getLimits = (state: RootState): SceneMetrics => state.sceneMetrics.limits;
export const getEntitiesOutOfBoundaries = (state: RootState): number[] =>
  state.sceneMetrics.entitiesOutOfBoundaries;
export const getHasCustomCode = (state: RootState): boolean => state.sceneMetrics.hasCustomCode;

// Reducer
export default sceneMetrics.reducer;
