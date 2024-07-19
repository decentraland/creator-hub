import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { workspace } from '#preload';
import type { Workspace } from '/shared/types/workspace';
import { SortBy } from '/shared/types/projects';
import type { Async } from '../../async';

// actions
const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
const createProject = createAsyncThunk('workspace/createProject', workspace.createProject);
const deleteProject = createAsyncThunk('workspace/deleteProject', workspace.deleteProject);
const duplicateProject = createAsyncThunk('workspace/duplicateProject', workspace.duplicateProject);
const importProject = createAsyncThunk('workspace/importProject', workspace.importProject);

// state
export type WorkspaceState = Async<Workspace>;

const initialState: WorkspaceState = {
  sortBy: SortBy.NEWEST,
  projects: [],
  status: 'idle',
  error: null,
};
// slice
export const slice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setSortBy: (state, { payload: type }: PayloadAction<SortBy>) => {
      state.sortBy = type;
    },
  },
  extraReducers: builder => {
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
          projects: state.projects.filter($ => $.path !== action.meta.arg),
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to delete project ${action.meta.arg}`;
      })
      .addCase(duplicateProject.pending, state => {
        state.status = 'loading';
      })
      .addCase(duplicateProject.fulfilled, (state, action) => {
        return {
          ...state,
          projects: state.projects.concat(action.payload),
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(duplicateProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to duplicate project ${action.meta.arg}`;
      })
      .addCase(importProject.pending, state => {
        state.status = 'loading';
      })
      .addCase(importProject.fulfilled, (state, action) => {
        return {
          ...state,
          projects: state.projects.concat(action.payload),
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(importProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to import project ${action.meta.arg}`;
      });
  },
});

// exports
export const actions = {
  ...slice.actions,
  getWorkspace,
  createProject,
  deleteProject,
  duplicateProject,
  importProject,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };