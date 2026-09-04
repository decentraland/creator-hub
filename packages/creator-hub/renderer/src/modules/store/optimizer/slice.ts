import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { optimizer as optimizerPreload } from '#preload';
import type {
  OptimizeOptions,
  OptimizeProgress,
  OptimizeResult,
  OptimizeScanResult,
} from '/shared/types/optimizer';

import { createAsyncThunk } from '../thunk';

type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

type OptimizerState = {
  isOpen: boolean;
  // The creator has seen the disclosure (what the feature uses) and chosen to continue.
  // Reset every time the window opens, so the decision is made each session.
  acknowledged: boolean;
  activePath: string | null;
  scan: OptimizeScanResult | null;
  scanStatus: Status;
  runStatus: Status;
  progress: OptimizeProgress | null;
  result: OptimizeResult | null;
  error: string | null;
};

const initialState: OptimizerState = {
  isOpen: false,
  acknowledged: false,
  activePath: null,
  scan: null,
  scanStatus: 'idle',
  runStatus: 'idle',
  progress: null,
  result: null,
  error: null,
};

export const scanProject = createAsyncThunk('optimizer/scan', async (path: string) => {
  const scan = await optimizerPreload.scan(path);
  return { path, scan };
});

export const runOptimize = createAsyncThunk(
  'optimizer/run',
  async ({ path, options }: { path: string; options: OptimizeOptions }) => {
    const result = await optimizerPreload.run(path, options);
    const scan = await optimizerPreload.scan(path);
    return { result, scan };
  },
);

export const revertProject = createAsyncThunk('optimizer/revert', async (path: string) => {
  await optimizerPreload.revert(path);
  const scan = await optimizerPreload.scan(path);
  return { scan };
});

const slice = createSlice({
  name: 'optimizer',
  initialState,
  reducers: {
    open: state => {
      state.isOpen = true;
      state.acknowledged = false;
    },
    acknowledge: state => {
      state.acknowledged = true;
    },
    close: state => {
      state.isOpen = false;
      state.acknowledged = false;
    },
    setProgress: (state, action: PayloadAction<OptimizeProgress>) => {
      state.progress = action.payload;
    },
    reset: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(scanProject.pending, (state, action) => {
        state.scanStatus = 'loading';
        state.activePath = action.meta.arg;
        state.scan = null;
        state.result = null;
        state.progress = null;
        state.error = null;
      })
      .addCase(scanProject.fulfilled, (state, action) => {
        state.scanStatus = 'succeeded';
        state.scan = action.payload.scan;
      })
      .addCase(scanProject.rejected, (state, action) => {
        state.scanStatus = 'failed';
        state.error = action.error.message ?? 'Scan failed';
      })
      .addCase(runOptimize.pending, state => {
        state.runStatus = 'loading';
        state.result = null;
        state.error = null;
      })
      .addCase(runOptimize.fulfilled, (state, action) => {
        state.runStatus = 'succeeded';
        state.result = action.payload.result;
        state.scan = action.payload.scan;
      })
      .addCase(runOptimize.rejected, (state, action) => {
        state.runStatus = 'failed';
        state.error = action.error.message ?? 'Optimization failed';
      })
      .addCase(revertProject.fulfilled, (state, action) => {
        state.scan = action.payload.scan;
        state.result = null;
        state.progress = null;
        state.runStatus = 'idle';
      });
  },
});

export const actions = { ...slice.actions, scanProject, runOptimize, revertProject };
export const { reducer } = slice;
