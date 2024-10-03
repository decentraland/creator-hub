import pLimit from 'p-limit';
import { editor, npm, settings } from '#preload';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { type Project } from '/shared/types/projects';
import { UPDATE_DEPENDENCIES_STRATEGY } from '/shared/types/settings';
import { SDK_PACKAGE } from '/shared/types/pkg';

import { actions as workspaceActions } from '../workspace';

const limit = pLimit(1);

// actions
export const fetchVersion = createAsyncThunk('editor/fetchVersion', editor.getVersion);
export const install = createAsyncThunk('editor/install', editor.install);
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const runScene = createAsyncThunk('editor/runScene', editor.runScene);
export const publishScene = createAsyncThunk('editor/publishScene', editor.publishScene);
export const openTutorial = createAsyncThunk('editor/openTutorial', editor.openTutorial);
export const setProject = createAsyncThunk('editor/setProject', async (project: Project) => {
  const updateStrategySetting = await settings.getUpdateDependenciesStrategy();

  if (updateStrategySetting === UPDATE_DEPENDENCIES_STRATEGY.DO_NOTHING) {
    return project;
  }

  const isOutdated = await limit(() => npm.packageOutdated(project.path, SDK_PACKAGE));

  const updatedPackageStatus: Project['packageStatus'] = {
    ...project.packageStatus,
    [SDK_PACKAGE]: { isOutdated },
  };

  if (updateStrategySetting === UPDATE_DEPENDENCIES_STRATEGY.AUTO_UPDATE && isOutdated) {
    try {
      await limit(() => npm.install(project.path, SDK_PACKAGE));
      updatedPackageStatus[SDK_PACKAGE].showUpdatedNotification = true;
    } catch (_) {
      updatedPackageStatus[SDK_PACKAGE].showUpdatedNotification = false;
    }
  }

  return {
    ...project,
    packageStatus: updatedPackageStatus,
  };
});

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
  error: string | null;
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
    builder.addCase(setProject.fulfilled, (state, action) => {
      state.project = action.payload;
      state.loadingInspector = false;
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
      state.error = action.error.message || null;
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
      state.error = action.error.message || null;
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
      state.error = action.error.message || null;
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
      state.error = action.error.message || null;
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
  setProject,
  fetchVersion,
  install,
  startInspector,
  runScene,
  publishScene,
  openTutorial,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
