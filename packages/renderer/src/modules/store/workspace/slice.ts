import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { workspace } from '#preload';

import type { Workspace } from '/shared/types/workspace';
import { SortBy } from '/shared/types/projects';

import type { Async } from '/@/modules/async';

// actions
const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
const createProject = createAsyncThunk('workspace/createProject', workspace.createProject);
const deleteProject = createAsyncThunk('workspace/deleteProject', workspace.deleteProject);
const duplicateProject = createAsyncThunk('workspace/duplicateProject', workspace.duplicateProject);
const importProject = createAsyncThunk('workspace/importProject', workspace.importProject);
const reimportProject = createAsyncThunk('workspace/reimportProject', workspace.reimportProject);
const unlistProjects = createAsyncThunk('workspace/unlistProjects', workspace.unlistProjects);
const saveThumbnail = createAsyncThunk(
  'workspace/saveThumbnail',
  async ({ path, thumbnail }: Parameters<typeof workspace.saveThumbnail>[0]) => {
    await workspace.saveThumbnail({ path, thumbnail });
    const project = await workspace.getProject(path);
    return project;
  },
);

// state
export type WorkspaceState = Async<Workspace>;

const initialState: WorkspaceState = {
  sortBy: SortBy.NEWEST,
  projects: [],
  missing: [],
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
    setProjectTitle: (state, { payload }: PayloadAction<{ path: string; title: string }>) => {
      const project = state.projects.find($ => $.path === payload.path)!;
      project.title = payload.title;
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
        const newProject = action.payload;
        return {
          ...state,
          projects: newProject ? state.projects.concat(newProject) : state.projects,
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(importProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to import project ${action.meta.arg}`;
      })
      .addCase(reimportProject.pending, state => {
        state.status = 'loading';
      })
      .addCase(reimportProject.fulfilled, (state, action) => {
        const newProject = action.payload;
        return {
          ...state,
          projects: newProject ? state.projects.concat(newProject) : state.projects,
          missing: newProject ? state.missing.filter($ => $ !== action.meta.arg) : state.missing,
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(reimportProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to re-import project ${action.meta.arg}`;
      })
      .addCase(unlistProjects.pending, state => {
        state.status = 'loading';
      })
      .addCase(unlistProjects.fulfilled, (state, action) => {
        const pathsSet = new Set(action.meta.arg);
        return {
          ...state,
          missing: state.missing.filter($ => !pathsSet.has($)),
          status: 'succeeded',
          error: null,
        };
      })
      .addCase(unlistProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || `Failed to unlists projects: ${action.meta.arg}`;
      })
      .addCase(saveThumbnail.fulfilled, (state, { payload: project }) => {
        const projectIdx = state.projects.findIndex($ => $.path === project.path);
        if (projectIdx !== -1) {
          state.projects[projectIdx] = project;
        }
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
  reimportProject,
  unlistProjects,
  saveThumbnail,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
