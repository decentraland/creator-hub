import { createSlice } from '@reduxjs/toolkit';

import type { Workspace } from '/shared/types/workspace';
<<<<<<< HEAD
import { createProject, getWorkspace } from './thunks';
=======
import { deleteProject, getWorkspace } from './thunks';
>>>>>>> 2896200 (implement delete scene)
import type { Async } from '../types';

const INITIAL_STATE: Async<Workspace> = {
  projects: [],
  status: 'idle',
  error: null,
};

export function createWorkspaceSlice() {
  const { actions, reducer, selectors } = createSlice({
    name: 'workspace',
    initialState: INITIAL_STATE,
    reducers: {},
    extraReducers: (builder) => {
      // nth: generic case adder so we don't end up with this mess 👇
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
        })
        .addCase(createProject.fulfilled, (state, action) => {
          state.projects = [...state.projects, action.payload];
        })
        .addCase(deleteProject.pending, state => {
          state.status = 'loading';
        })
        .addCase(deleteProject.fulfilled, (state, action) => {
          return {
            ...state,
            projects: state.projects.filter(($) => $.path !== action.meta.arg),
            status: 'succeeded',
            error: null,
          };
        })
        .addCase(deleteProject.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.error.message || `Failed to delete project ${action.meta.arg}`;
        });
    },
  });

  return { actions, reducer, selectors };
}
