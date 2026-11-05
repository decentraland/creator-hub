import { createSlice, isRejectedWithValue } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';
import type { Scene } from '@dcl/schemas';
import { createAsyncThunk } from '/@/modules/store/thunk';

import { supportsMcp, supportsMultiInstance, supportsUiDesigner } from '/shared/flags';
import type { DeployOptions } from '/shared/types/deploy';
import { isProjectError, ProjectError, type Project } from '/shared/types/projects';
import { type PreviewOptions } from '/shared/types/settings';
import { isWorkspaceError } from '/shared/types/workspace';

import { editor } from '#preload';

import { getActiveSceneClient, waitForActiveSceneReady } from '/@/modules/rpc/active-scene';
import {
  type SceneRpcClient,
  SceneRpcTimeoutError,
  SceneRpcUnsupportedError,
} from '/@/modules/rpc/scene/client';
import { t } from '/@/modules/store/translation/utils';

import { actions as deploymentActions } from '../deployment';
import { registerDeployServer } from '../deployment/deploy-api';
import { actions as workspaceActions } from '../workspace';

// actions
export const fetchVersion = createAsyncThunk('editor/fetchVersion', editor.getVersion);
export const install = createAsyncThunk('editor/install', editor.install);
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const runScene = createAsyncThunk(
  'editor/runScene',
  async ({ path, mobile, ...opts }: PreviewOptions & { path: string; mobile?: boolean }) => {
    await editor.runScene({ path, opts, mobile });
  },
);
// Handing the placement over and reading it back are best effort: the final scene.json
// write before the deploy already guarantees the deployed placement, so neither may hold
// the publish up for long.
const PLACEMENT_BUDGET_MS = 15_000;
// The flush is not best effort (#1512), but a hung editor must not stall the publish for
// longer than a large scene's save legitimately takes (the client's save_scene timeout).
const FLUSH_BUDGET_MS = 60_000;

const never = new Promise<never>(() => undefined);

/**
 * Sends a request the open editor must answer within `budgetMs`, resending it to the
 * reloaded editor every time the inspector iframe reloads first. Under Bevy storing a new
 * base reloads the iframe, sometimes twice in a row; a request sent to a page on its way
 * out is never answered, so after a reload it is abandoned rather than waited on. Both
 * requests this carries are idempotent, so resending is safe.
 *
 * Settles with the editor's answer, rejects with the editor's own error when it answered
 * with one, and with `SceneRpcTimeoutError` when no answer came within the budget.
 */
async function sendSurvivingReload<T>(
  scene: SceneRpcClient,
  method: string,
  send: (scene: SceneRpcClient) => Promise<T>,
  budgetMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new SceneRpcTimeoutError(method)), budgetMs);
  });
  try {
    for (let target = scene; ; target = getActiveSceneClient() ?? target) {
      const reload = waitForActiveSceneReady();
      try {
        // An unanswered request may have reached a page that is reloading: keep waiting
        // for the reload until the deadline instead of giving up on the client's timeout.
        const answer = send(target).catch((error: unknown) => {
          if (error instanceof SceneRpcTimeoutError) return never;
          throw error;
        });
        const outcome = await Promise.race([
          answer.then(value => ({ value })),
          reload.ready.then(() => null),
          deadline,
        ]);
        if (outcome) return outcome.value;
      } finally {
        reload.cancel();
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

const toCoords = (parcel: string) => {
  const [x, y] = parcel.split(',').map(Number);
  return { x, y };
};

type EditorLayout = { base: { x: number; y: number }; parcels: { x: number; y: number }[] };

const toEditorLayout = (scene: Partial<Scene>['scene']): EditorLayout | null =>
  scene?.base && scene.parcels?.length
    ? { base: toCoords(scene.base), parcels: scene.parcels.map(toCoords) }
    : null;

/**
 * Hands the parcels picked in the publish dialog to the open editor, whose Scene component
 * owns the layout in scene.json. Written only to disk, the pick is reverted by the flush
 * below and again by the editor's next autosave, and the deploy targets the old parcels.
 *
 * @returns whether the editor took it.
 */
async function pushLayoutToEditor(layout: EditorLayout): Promise<boolean> {
  const scene = getActiveSceneClient();
  if (!scene) return false;
  try {
    await sendSurvivingReload(
      scene,
      'set_scene_settings',
      editor => editor.setSceneSettings({ layout }),
      PLACEMENT_BUDGET_MS,
    );
    return true;
  } catch (error) {
    // An editor that cannot take the layout keeps its own; publishing still deploys the
    // pick, because the updates are written to disk again after the flush.
    if (!(error instanceof SceneRpcUnsupportedError)) {
      console.error('Could not hand the publish placement to the editor:', error);
    }
    return false;
  }
}

const parcelId = ({ x, y }: { x: number; y: number }) => `${x},${y}`;

/** Same base and same set of parcels; the editor may list the parcels in another order. */
function sameLayout(held: unknown, wanted: EditorLayout): boolean {
  const layout = held as Partial<EditorLayout> | undefined;
  if (!layout?.base || !Array.isArray(layout.parcels)) return false;
  if (parcelId(layout.base) !== parcelId(wanted.base)) return false;
  const heldParcels = new Set(layout.parcels.map(parcelId));
  return (
    heldParcels.size === wanted.parcels.length &&
    wanted.parcels.every(p => heldParcels.has(parcelId(p)))
  );
}

/**
 * Whether the editor on screen now holds `layout`. A reloaded editor reports no settings
 * until its data layer has streamed the scene in, so an empty answer is polled, within
 * the placement budget.
 */
async function editorHoldsLayout(layout: EditorLayout): Promise<boolean> {
  const deadline = Date.now() + PLACEMENT_BUDGET_MS;
  for (;;) {
    const remaining = deadline - Date.now();
    const scene = getActiveSceneClient();
    if (!scene) return true;
    if (remaining <= 0) return false;
    try {
      const { settings } = await sendSurvivingReload(
        scene,
        'get_scene_settings',
        editor => editor.getSceneSettings(),
        remaining,
      );
      if (settings.layout) return sameLayout(settings.layout, layout);
    } catch (error) {
      if (error instanceof SceneRpcUnsupportedError) return true;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

/**
 * Leaves the pick in the open editor and the editor flushed to disk. Under Bevy, storing the
 * pick reloads the inspector at the new base, and an edit answered by the iframe that is
 * about to go away never reaches its data layer. The flush rides the same connection as the
 * edit, so once it returns the data layer holds whatever the editor answered for; reading
 * the layout back afterwards tells a lost edit apart, and one more round fixes it.
 */
async function flushEditorWithLayout(updates: Partial<Scene> | undefined) {
  const layout = toEditorLayout(updates?.scene);
  for (let attempt = 1; ; attempt++) {
    const pushed = layout ? await pushLayoutToEditor(layout) : false;
    await flushEditorToDisk();
    if (!layout || !pushed || (await editorHoldsLayout(layout))) return;
    if (attempt === 2) {
      console.error('The editor did not keep the publish placement; deploying it from disk.');
      return;
    }
  }
}

/**
 * Pushes the open editor's queued writes to disk before a deploy reads the project back.
 *
 * The Inspector saves asynchronously, so an edit made moments before hitting Publish can
 * still be in flight — or have failed — while `sdk-commands deploy` packages whatever
 * scene.json is on disk. Failing here is deliberate: publishing content the creator cannot
 * see is worse than not publishing at all.
 *
 * A closed editor (no iframe mounted) has nothing to flush and is not an error.
 */
async function flushEditorToDisk() {
  const scene = getActiveSceneClient();
  if (!scene) return;

  // Stops the publish when the editor answers that the save failed, or when it neither
  // answers nor reloads within the budget: either way its pending edits may not be on disk.
  // A reload is not a failure: the reloaded editor is flushed instead.
  try {
    await sendSurvivingReload(scene, 'save_scene', editor => editor.saveScene(), FLUSH_BUDGET_MS);
  } catch (error) {
    // An inspector that predates save_scene (a dev build served on VITE_INSPECTOR_PORT, say)
    // cannot flush on request. Publishing then behaves exactly as it did before this RPC
    // existed, rather than being blocked by an editor that never could have answered.
    if (error instanceof SceneRpcUnsupportedError) return;
    throw new Error(
      t('editor.publish.save_failed', {
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export type PublishSceneOptions = DeployOptions & {
  /** What the publish dialog chose (parcels, world): must be in the scene.json deployed. */
  sceneUpdates?: Partial<Scene>;
};

export const publishScene = createAsyncThunk(
  'editor/publishScene',
  async ({ sceneUpdates, ...opts }: PublishSceneOptions, { dispatch, getState }) => {
    const { translation } = getState();
    // Before marking anything replaced: a failed flush starts no deploy, so the previous
    // deployment must stay retryable.
    await flushEditorWithLayout(sceneUpdates);
    if (sceneUpdates) {
      // Last write before the deploy reads scene.json: a data layer bundled in an older
      // sdk-commands (the Bevy editor's) still writes the copy it loaded over the whole
      // file on flush, dropping the world and any layout the editor could not take.
      await dispatch(
        workspaceActions.updateSceneJson({ path: opts.path, updates: sceneUpdates }),
      ).unwrap();
    }
    // Main stops the previous CLI, so a retry of the previous deployment must not start another.
    dispatch(deploymentActions.markDeploymentReplaced({ path: opts.path }));
    const server = await editor.publishScene({ ...opts, language: translation.locale });
    const { supportsDeployResource, hasCancelToken } = registerDeployServer(server);
    await dispatch(
      deploymentActions.initializeDeployment({
        path: opts.path,
        port: server.port,
        supportsDeployResource,
        hasCancelToken,
        chainId: opts.chainId,
        wallet: opts.wallet,
      }),
    ).unwrap();
    return server.port;
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
  async ({ path, opts }: { path: string; opts: PreviewOptions }, { dispatch }) => {
    // `mobile: true` asks main for a server the phone can reach: it reuses whatever preview
    // is already up (desktop client, Bevy tab) and otherwise starts one without opening any
    // client. Always dispatched — main decides from the live process, whereas this store's
    // isPreviewRunning only flips back on an explicit kill and can be stale.
    await dispatch(runScene({ path, ...opts, mobile: true })).unwrap();

    const data = await editor.getMobilePreview(path);
    // null is main's "no usable server" (no LAN IP, preview gone): fail loudly so the
    // caller's error path runs instead of the click silently doing nothing
    if (!data) throw new Error('Mobile preview is unavailable for this scene');
    return data;
  },
);

// state
export type EditorState = {
  version: string | null;
  supportsMultiInstance: boolean;
  supportsMcp: boolean;
  supportsUiDesigner: boolean;
  supportsAuthServer: boolean;
  project?: Project;
  capabilityPath: string | null;
  // The scene last asked to open. Set as soon as it starts opening, unlike `project`.
  openingProjectPath?: string;
  inspectorPort: number;
  publishPort: number;
  loadingPublish: boolean;
  publishError: string | null;
  loadingInspector: boolean;
  loadingPreview: boolean;
  // The run that owns `loadingPreview`. A run that settles after the user left its scene
  // (or after a newer run took over) must not touch the state of the scene now open.
  previewRun: { requestId: string; path: string } | null;
  isPreviewRunning: boolean;
  // The scene whose preview `isPreviewRunning` describes, so a late stop of a scene the
  // user already left can't clear the flag for the preview of the scene now open.
  runningPreviewPath: string | null;
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
  supportsAuthServer: false,
  capabilityPath: null,
  inspectorPort: 0,
  publishPort: 0,
  loadingPublish: false,
  publishError: null,
  loadingInspector: false,
  loadingPreview: false,
  previewRun: null,
  isPreviewRunning: false,
  runningPreviewPath: null,
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
  reducers: {
    // The editor was closed: a scene that was still opening no longer is.
    leaveProject: state => {
      state.openingProjectPath = undefined;
    },
  },
  extraReducers: builder => {
    builder.addCase(workspaceActions.runProject.pending, (state, action) => {
      state.project = undefined;
      state.openingProjectPath = action.meta.arg.path;
      state.supportsMultiInstance = false;
      state.supportsMcp = false;
      state.supportsUiDesigner = false;
      state.supportsAuthServer = false;
      state.capabilityPath = action.meta.arg.path;
      state.error = null;
    });
    builder.addCase(workspaceActions.fetchSdkCommandsVersion.fulfilled, (state, action) => {
      if (state.capabilityPath !== null && action.meta.arg !== state.capabilityPath) return;
      state.supportsMultiInstance = supportsMultiInstance(action.payload.version);
      state.supportsMcp = supportsMcp(action.payload.version);
      state.supportsUiDesigner = supportsUiDesigner(action.payload.version);
      state.supportsAuthServer = action.payload.hasAuthServer;
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
      state.openingProjectPath = undefined;
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
    builder.addCase(runScene.pending, (state, action) => {
      state.loadingPreview = true;
      state.previewRun = { requestId: action.meta.requestId, path: action.meta.arg.path };
    });
    builder.addCase(runScene.fulfilled, (state, action) => {
      if (state.previewRun?.requestId !== action.meta.requestId) return;
      state.previewRun = null;
      state.loadingPreview = false;
      state.isPreviewRunning = true;
      state.runningPreviewPath = action.meta.arg.path;
    });
    builder.addCase(runScene.rejected, (state, action) => {
      captureException(action.error, {
        tags: { source: 'editor-page', event: 'run-scene' },
      });
      if (state.previewRun?.requestId !== action.meta.requestId) return;
      state.previewRun = null;
      state.loadingPreview = false;
    });
    // On pending, not fulfilled: killing waits for the process to die (up to the force-kill
    // timeout), and the scene the user moved to may start its own preview meanwhile.
    builder.addCase(killPreviewScene.pending, (state, action) => {
      const path = action.meta.arg;
      if (state.previewRun?.path === path) {
        state.previewRun = null;
        state.loadingPreview = false;
      }
      if (state.runningPreviewPath === path) {
        state.isPreviewRunning = false;
        state.runningPreviewPath = null;
      }
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
