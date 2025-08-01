import { createSlice, isRejectedWithValue } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';

import { createAsyncThunk } from '/@/modules/store/thunk';

import type { DeployOptions } from '/shared/types/deploy';
import { isProjectError, ProjectError, type Project } from '/shared/types/projects';
import type { PreviewOptions } from '/shared/types/settings';
import { isWorkspaceError } from '/shared/types/workspace';

import { editor } from '#preload';

import { actions as deploymentActions } from '../deployment';
import { actions as workspaceActions } from '../workspace';

// actions
export const fetchVersion = createAsyncThunk('editor/fetchVersion', editor.getVersion);
export const install = createAsyncThunk('editor/install', editor.install);
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const runScene = createAsyncThunk(
  'editor/runScene',
  async ({ path, ...opts }: PreviewOptions & { path: string }) => {
    const { debugger: openDebugger } = opts;
    const id = await editor.runScene({ path, opts });
    if (openDebugger) {
      await editor.openSceneDebugger(id);
    }
  },
);
export const publishScene = createAsyncThunk(
  'editor/publishScene',
  async (opts: DeployOptions, { dispatch, getState }) => {
    const { translation } = getState();
    const port = await editor.publishScene({ ...opts, language: translation.locale });
    const deployment = { path: opts.path, port, chainId: opts.chainId, wallet: opts.wallet };
    dispatch(deploymentActions.initializeDeployment(deployment));
    return port;
  },
);
export const killPreviewScene = createAsyncThunk(
  'editor/killPreviewScene',
  editor.killPreviewScene,
);
export const openTutorial = createAsyncThunk('editor/openTutorial', editor.openTutorial);
export const openExternalURL = createAsyncThunk('editor/openExternalURL', editor.openExternalURL);

// state
export type EditorState = {
  version: string | null;
  project?: Project;
  inspectorPort: number;
  publishPort: number;
  loadingPublish: boolean;
  publishError: string | null;
  loadingInspector: boolean;
  loadingPreview: boolean;
  isInstalling: boolean;
  isInstalled: boolean;
  isInstallingProject: boolean;
  isInstalledProject: boolean;
  isFetchingVersion: boolean;
  error: Error | string | null;
};

const initialState: EditorState = {
  version: null,
  inspectorPort: 0,
  publishPort: 0,
  loadingPublish: false,
  publishError: null,
  loadingInspector: false,
  loadingPreview: false,
  isInstalling: false,
  isInstallingProject: false,
  isInstalledProject: false,
  isInstalled: false,
  isFetchingVersion: false,
  error: null,
};

// Helper functions for common dependencies installation state updates
const handleInstallationStart = (state: EditorState) => {
  state.isInstallingProject = true;
  state.error = null;
};

const handleInstallationSuccess = (state: EditorState) => {
  state.isInstalledProject = true;
  state.isInstallingProject = false;
  state.error = null;
};

const handleInstallationFailure = (state: EditorState, errorMessage?: string) => {
  state.isInstallingProject = false;
  state.error = errorMessage ? new Error(errorMessage) : null;
};

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
      if (!state.isInstallingProject && !state.isInstalledProject) {
        state.isInstalledProject = true;
      }
      state.error = null;
    });
    builder.addCase(workspaceActions.runProject.rejected, (state, action) => {
      if (isRejectedWithValue(action) && isWorkspaceError(action.payload, 'PROJECT_NOT_FOUND')) {
        state.error = action.payload;
      } else {
        state.error = new ProjectError('FAILED_TO_RUN_PROJECT');

        captureException(state.error, {
          tags: { source: 'editor-page' },
          extra: { context: 'Unknown error in runProject', action },
        });
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
      state.publishError = null;
    });
    builder.addCase(publishScene.fulfilled, (state, action) => {
      state.publishPort = action.payload;
      state.loadingPublish = false;
    });
    builder.addCase(publishScene.rejected, (state, action) => {
      state.publishError = action.error.message || null;
      state.loadingPublish = false;
    });
    builder.addCase(workspaceActions.createProject.pending, state => {
      state.project = undefined;
    });
    builder.addCase(workspaceActions.createProject.fulfilled, (state, action) => {
      state.project = action.payload;
    });
    builder.addCase(workspaceActions.createProject.rejected, state => {
      state.error = new ProjectError('PROJECT_NOT_CREATED');
      state.project = undefined;
    });
    builder.addCase(workspaceActions.createProjectAndInstall.rejected, state => {
      if (isProjectError(state.error)) state.error = new ProjectError('PROJECT_NOT_CREATED');
      state.project = undefined;
    });
    builder.addCase(workspaceActions.updateProject, (state, action) => {
      if (state.project) state.project = action.payload;
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
      state.error = action.error.message ? new Error(action.error.message) : null;
      state.isFetchingVersion = false;
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
    builder.addCase(workspaceActions.saveAndGetThumbnail.pending, state => {
      if (state.project) state.project.status = 'loading';
    });
    builder.addCase(workspaceActions.installProject.pending, state => {
      handleInstallationStart(state);
    });
    builder.addCase(workspaceActions.installProject.fulfilled, handleInstallationSuccess);
    builder.addCase(workspaceActions.installProject.rejected, (state, action) => {
      handleInstallationFailure(
        state,
        action.error.message || 'Failed to install project dependencies',
      );
    });
    builder.addCase(workspaceActions.updatePackages.pending, state => {
      handleInstallationStart(state);
    });
    builder.addCase(workspaceActions.updatePackages.fulfilled, handleInstallationSuccess);
    builder.addCase(workspaceActions.updatePackages.rejected, (state, action) => {
      state.error = new ProjectError('FAILED_TO_INSTALL_DEPENDENCIES');
      state.isInstallingProject = false;
    });
    builder.addCase(workspaceActions.saveAndGetThumbnail.fulfilled, (state, action) => {
      if (state.project) {
        state.project.thumbnail = action.payload;
        state.project.status = 'succeeded';
      }
    });
    builder.addCase(workspaceActions.saveAndGetThumbnail.rejected, state => {
      if (state.project) state.project.status = 'failed';
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
  killPreviewScene,
  openExternalURL,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
