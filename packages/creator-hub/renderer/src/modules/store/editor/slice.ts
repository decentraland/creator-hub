import { createAction, createSlice, isRejectedWithValue } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';
import { createAsyncThunk } from '/@/modules/store/thunk';

import { supportsMcp, supportsMultiInstance, supportsUiDesigner } from '/shared/flags';
import type { DeployOptions } from '/shared/types/deploy';
import type { PreviewProgress } from '/shared/types/ipc';
import { isProjectError, ProjectError, type Project } from '/shared/types/projects';
import { type PreviewOptions } from '/shared/types/settings';
import { isWorkspaceError } from '/shared/types/workspace';

import { editor } from '#preload';

import { actions as deploymentActions } from '../deployment';
import { actions as workspaceActions } from '../workspace';

// actions
export const fetchVersion = createAsyncThunk('editor/fetchVersion', editor.getVersion);
export const install = createAsyncThunk('editor/install', editor.install);
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const setPreviewProgress = createAction<PreviewProgress | null>('editor/setPreviewProgress');
export const runScene = createAsyncThunk(
  'editor/runScene',
  async (
    { path, mobile, ...opts }: PreviewOptions & { path: string; mobile?: boolean },
    { dispatch },
  ) => {
    // Surfaces the sidecar's asset-conversion progress (a large scene's first
    // conversion can take minutes before the preview is ready)
    const subscription = editor.subscribePreviewProgress(path, progress =>
      dispatch(setPreviewProgress(progress)),
    );
    try {
      await editor.runScene({ path, opts, mobile });
    } finally {
      subscription.cleanup();
      dispatch(setPreviewProgress(null));
    }
  },
);
// Cancels a preview that's still converting: the spawn is killed and the pending
// runScene settles without opening the client.
export const cancelPreview = createAsyncThunk('editor/cancelPreview', editor.cancelPreview);
export const publishScene = createAsyncThunk(
  'editor/publishScene',
  async (opts: DeployOptions, { dispatch, getState }) => {
    const { translation } = getState();
    const port = await editor.publishScene({ ...opts, language: translation.locale });
    const deployment = { path: opts.path, port, chainId: opts.chainId, wallet: opts.wallet };
    await dispatch(deploymentActions.initializeDeployment(deployment)).unwrap();
    return port;
  },
);
export const killPreviewScene = createAsyncThunk(
  'editor/killPreviewScene',
  editor.killPreviewScene,
);
export const openTutorial = createAsyncThunk('editor/openTutorial', editor.openTutorial);
export const openExternalURL = createAsyncThunk('editor/openExternalURL', editor.openExternalURL);

export const getMobileQR = createAsyncThunk(
  'editor/getMobileQR',
  async ({ path, opts }: { path: string; opts: PreviewOptions }, { dispatch, getState }) => {
    const { editor: editorState } = getState();

    // Start preview if not running. `mobile: true` runs the preview server without
    // opening the desktop client — the QR only needs the server for the phone to reach.
    if (!editorState.isPreviewRunning) {
      await dispatch(runScene({ path, ...opts, mobile: true })).unwrap();
    }

    // Fetch mobile QR data
    const data = await editor.getMobilePreview(path);
    return data;
  },
);

// state
export type EditorState = {
  version: string | null;
  supportsMultiInstance: boolean;
  supportsMcp: boolean;
  supportsUiDesigner: boolean;
  project?: Project;
  inspectorPort: number;
  publishPort: number;
  loadingPublish: boolean;
  publishError: string | null;
  loadingInspector: boolean;
  loadingPreview: boolean;
  previewProgress: PreviewProgress | null;
  previewCancelled: boolean;
  isPreviewRunning: boolean;
  isInstalling: boolean;
  isInstalled: boolean;
  isInstallingProject: boolean;
  isInstalledProject: boolean;
  isFetchingVersion: boolean;
  error: Error | string | null;
};

const initialState: EditorState = {
  version: null,
  supportsMultiInstance: false,
  supportsMcp: false,
  supportsUiDesigner: false,
  inspectorPort: 0,
  publishPort: 0,
  loadingPublish: false,
  publishError: null,
  loadingInspector: false,
  loadingPreview: false,
  previewProgress: null,
  previewCancelled: false,
  isPreviewRunning: false,
  isInstalling: false,
  isInstallingProject: false,
  isInstalledProject: false,
  isInstalled: false,
  isFetchingVersion: false,
  error: null,
};

// slice
export const slice = createSlice({
  name: 'editor',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(setPreviewProgress, (state, action) => {
      state.previewProgress = action.payload;
    });
    builder.addCase(workspaceActions.runProject.pending, state => {
      state.project = undefined;
      state.supportsMultiInstance = false;
      state.supportsMcp = false;
      state.supportsUiDesigner = false;
      state.error = null;
    });
    builder.addCase(workspaceActions.fetchSdkCommandsVersion.fulfilled, (state, action) => {
      state.supportsMultiInstance = supportsMultiInstance(action.payload);
      state.supportsMcp = supportsMcp(action.payload);
      state.supportsUiDesigner = supportsUiDesigner(action.payload);
    });
    builder.addCase(workspaceActions.runProject.fulfilled, (state, action) => {
      state.project = action.payload;
      state.error = null;
    });
    builder.addCase(workspaceActions.runProject.rejected, (state, action) => {
      if (isRejectedWithValue(action) && isWorkspaceError(action.payload, 'PROJECT_NOT_FOUND')) {
        state.error = action.payload;
      } else {
        state.error = new ProjectError('FAILED_TO_RUN_PROJECT');
        captureException(state.error, {
          tags: { source: 'editor-page', event: 'run-project' },
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
      captureException(action.error, {
        tags: { source: 'editor-page', event: 'publish-scene' },
      });
    });
    builder.addCase(workspaceActions.createProject.pending, state => {
      state.project = undefined;
    });
    builder.addCase(workspaceActions.createProject.fulfilled, (state, action) => {
      state.project = action.payload;
    });
    builder.addCase(workspaceActions.createProject.rejected, state => {
      state.error = new ProjectError('PROJECT_NOT_CREATED');
      captureException(state.error, {
        tags: { source: 'editor-page', event: 'create-project' },
      });
      state.project = undefined;
    });
    builder.addCase(workspaceActions.createProjectAndInstall.rejected, state => {
      if (isProjectError(state.error)) state.error = new ProjectError('PROJECT_NOT_CREATED');
      captureException(state.error, {
        tags: {
          source: 'editor-page',
          event: 'create-and-install-project',
        },
      });
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
      state.previewCancelled = false;
    });
    builder.addCase(runScene.fulfilled, state => {
      state.loadingPreview = false;
      // a cancelled run settles quietly with no client opened, so it isn't "running"
      if (!state.previewCancelled) state.isPreviewRunning = true;
      state.previewCancelled = false;
    });
    builder.addCase(runScene.rejected, (state, action) => {
      state.loadingPreview = false;
      state.previewCancelled = false;
      captureException(action.error, {
        tags: { source: 'editor-page', event: 'run-scene' },
      });
    });
    // The button stays blocked until the cancel completes: killPreview resolves only once
    // the process is confirmed dead (up to the force-kill timeout), and unblocking earlier
    // would let a Preview press ride the dying spawn and report success without starting
    // anything — a running UI with nothing running.
    builder.addCase(cancelPreview.pending, state => {
      state.previewCancelled = true;
    });
    // guarded so a run started while the cancel was in flight (a mobile-QR start) keeps
    // its own loading state: runScene.pending already cleared previewCancelled for it
    builder.addCase(cancelPreview.fulfilled, state => {
      if (state.previewCancelled) state.loadingPreview = false;
    });
    builder.addCase(cancelPreview.rejected, state => {
      if (state.previewCancelled) state.loadingPreview = false;
    });
    builder.addCase(killPreviewScene.fulfilled, state => {
      state.isPreviewRunning = false;
    });
    builder.addCase(workspaceActions.saveAndGetThumbnail.pending, state => {
      if (state.project) state.project.status = 'loading';
    });
    builder.addCase(workspaceActions.installProject.pending, state => {
      state.isInstallingProject = true;
    });
    builder.addCase(workspaceActions.installProject.fulfilled, state => {
      state.isInstalledProject = true;
      state.isInstallingProject = false;
    });
    builder.addCase(workspaceActions.installProject.rejected, state => {
      state.error = new ProjectError('FAILED_TO_INSTALL_DEPENDENCIES');
      captureException(state.error, {
        tags: {
          source: 'editor-page',
          event: 'install-dependencies',
        },
      });
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
  setPreviewProgress,
  cancelPreview,
  fetchVersion,
  install,
  startInspector,
  runScene,
  publishScene,
  openTutorial,
  killPreviewScene,
  openExternalURL,
  getMobileQR,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
