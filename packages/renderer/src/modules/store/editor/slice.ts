import { createSlice } from '@reduxjs/toolkit';

import { editor } from '#preload';
import { createAsyncThunk } from '/@/modules/store/thunk';

import { type Project } from '/shared/types/projects';
import { WorkspaceError } from '/shared/types/workspace';

import { actions as workspaceActions } from '../workspace';

// actions
export const fetchVersion = createAsyncThunk('editor/fetchVersion', editor.getVersion);
export const install = createAsyncThunk('editor/install', editor.install);
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const runScene = createAsyncThunk('editor/runScene', editor.runScene);
export const publishScene = createAsyncThunk('editor/publishScene', editor.publishScene);
export const openTutorial = createAsyncThunk('editor/openTutorial', editor.openTutorial);

// state
export type EditorState = {
  version: string | null;
  project?: Project;
  inspectorPort: number;
  publishPort: number;
  loadingInspector: boolean;
  loadingPublish: boolean;
  loadingPreview: boolean;
  isInstalling: boolean;
  isInstalled: boolean;
  isFetchingVersion: boolean;
  error: Error | null;
};

const initialState: EditorState = {
  version: null,
  inspectorPort: 0,
  publishPort: 0,
  loadingInspector: false,
  loadingPublish: false,
  loadingPreview: false,
  isInstalling: false,
  isInstalled: false,
  isFetchingVersion: false,
  error: null,
};

// selectors

// slice
export const slice = createSlice({
  name: 'editor',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(workspaceActions.runProject.pending, state => {
      state.project = undefined;
      state.error = null;
    });
    builder.addCase(workspaceActions.runProject.fulfilled, (state, action) => {
      state.project = action.payload;
      state.error = null;
    });
    builder.addCase(workspaceActions.runProject.rejected, (state, payload) => {
      // TODO: Thunks return a SerializedError instead of the actual error thrown, so we have to do this
      // ugly hack 👇 to check for the error name, which instead should be using "isWorkspaceError" to check that.
      // Maybe there is a better way...
      if (payload.error.name === 'PROJECT_NOT_FOUND') {
        state.error = new WorkspaceError(payload.error.name);
      }
      state.project = undefined;
    });
    builder.addCase(startInspector.pending, state => {
      state.inspectorPort = 0;
      state.loadingInspector = true;
    });
    builder.addCase(startInspector.fulfilled, (state, action) => {
      state.inspectorPort = action.payload;
      state.loadingInspector = false;
    });
    builder.addCase(startInspector.rejected, (state, action) => {
      state.error = action.error.message ? new Error(action.error.message) : null;
      state.loadingInspector = false;
    });
    builder.addCase(publishScene.pending, state => {
      state.publishPort = 0;
      state.loadingPublish = true;
    });
    builder.addCase(publishScene.fulfilled, (state, action) => {
      state.publishPort = action.payload;
      state.loadingPublish = false;
    });
    builder.addCase(publishScene.rejected, (state, action) => {
      state.error = action.error.message ? new Error(action.error.message) : null;
      state.loadingPublish = false;
    });
    builder.addCase(workspaceActions.createProject.pending, state => {
      state.project = undefined;
    });
    builder.addCase(workspaceActions.createProject.fulfilled, (state, action) => {
      state.project = action.payload;
    });
    builder.addCase(workspaceActions.updateProject.fulfilled, (state, action) => {
      state.project = action.payload;
    });
    builder.addCase(install.pending, state => {
      state.isInstalling = true;
    });
    builder.addCase(install.fulfilled, state => {
      state.isInstalling = false;
      state.isInstalled = true;
    });
    builder.addCase(install.rejected, (state, action) => {
      state.error = action.error.message ? new Error(action.error.message) : null;
      state.isInstalling = false;
    });
    builder.addCase(fetchVersion.fulfilled, (state, action) => {
      state.version = action.payload;
      state.isFetchingVersion = false;
    });
    builder.addCase(fetchVersion.pending, state => {
      state.isFetchingVersion = true;
    });
    builder.addCase(fetchVersion.rejected, (state, action) => {
      state.error = action.error.message ? new Error(action.error.message) : null;
      state.isFetchingVersion = false;
    });
    builder.addCase(workspaceActions.setProjectTitle, (state, action) => {
      if (state.project?.path === action.payload.path) {
        state.project.title = action.payload.title;
      }
    });
    builder.addCase(workspaceActions.saveThumbnail.fulfilled, (state, action) => {
      if (state.project?.path === action.payload.path) {
        state.project.thumbnail = action.payload.thumbnail;
      }
    });
    builder.addCase(runScene.pending, state => {
      state.loadingPreview = true;
    });
    builder.addCase(runScene.fulfilled, state => {
      state.loadingPreview = false;
    });
    builder.addCase(runScene.rejected, state => {
      state.loadingPreview = false;
    });
  },
});

// exports
export const actions = {
  ...slice.actions,
  fetchVersion,
  install,
  startInspector,
  runScene,
  publishScene,
  openTutorial,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
