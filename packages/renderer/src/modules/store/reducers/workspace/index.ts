import {createSlice} from '@reduxjs/toolkit';

import type {Workspace} from '/shared/types/workspace';
import {getWorkspace} from './thunks';
import type {Async} from '../types';

const INITIAL_STATE: Async<Workspace> = {
  projects: [],
  status: 'idle',
  error: null,
};

export function createWorkspaceSlice() {
  const {actions, reducer, selectors} = createSlice({
    name: 'workspace',
    initialState: INITIAL_STATE,
    reducers: {},
    extraReducers: builder => {
      builder
        .addCase(getWorkspace.pending, state => {
          state.status = 'loading';
        })
        .addCase(getWorkspace.fulfilled, (_, action) => {
          return {
            ...action.payload,
            status: 'succeeded',
            error: null,
          };
        })
        .addCase(getWorkspace.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.error.message || 'Failed to get workspace';
        });
    },
  });

  return {actions, reducer, selectors};
}

export const {actions, reducer, selectors} = createWorkspaceSlice();
