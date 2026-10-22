import { createSlice, type PayloadAction, isRejectedWithValue } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';
import { Authenticator, type AuthIdentity } from '@dcl/crypto';
import type { ChainId } from '@dcl/schemas';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { AuthServerProvider } from '/@/lib/auth';

import { editor } from '#preload';
import { delay } from '/shared/utils';
import { isFetchError } from '/shared/fetch';
import type {
  DeploymentComponentsStatus,
  DeploymentStatus,
  DeployPhase,
  DeployState,
  DeployUpload,
  Info,
  File,
  ErrorName,
} from '/@/lib/deploy';
import { DeploymentError, isDeploymentError } from '/@/lib/deploy';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import { actions as managementActions } from '/@/modules/store/management';
import { createAsyncThunk } from '/@/modules/store/thunk';
import {
  checkDeploymentStatus,
  cleanPendingsFromDeploymentStatus,
  deriveOverallStatus,
  fetchDeploymentStatus,
  getInitialDeploymentStatus,
  retryDelayInMs,
  maxRetries,
  deploy as deployFn,
  getDeploymentUrl,
  fetchInfo,
  fetchFiles,
  getAvailableCatalystServer,
  translateError,
  getCatalystServers,
  isMaxPointerSizeExceededError,
  isInvalidCreatorWalletError,
} from './utils';
import {
  deployWithProgress,
  isDeployResourceAvailable,
  registerDeployServer,
  requestDeploymentCancel,
} from './deploy-api';

function buildError(action: any): Deployment['error'] {
  const error = isRejectedWithValue(action) ? action.payload : action.error;
  return {
    name: error?.name || 'UNKNOWN_ERROR',
    message: translateError(error),
    cause: error?.message,
  };
}

export interface Deployment {
  id: string;
  path: string;
  url: string;
  info: Info;
  files: File[];
  wallet: string;
  chainId: ChainId;
  status: DeploymentStatus;
  error?: { name: ErrorName; message: string; cause?: string };
  componentsStatus: DeploymentComponentsStatus;
  /** Whether the CLI serving `url` reports progress (`/api/deploy` resource). */
  supportsDeployResource: boolean;
  /** Whether the app holds the token the CLI requires to cancel the deployment. */
  hasCancelToken: boolean;
  phase?: DeployPhase;
  upload?: DeployUpload | null;
  /** The CLI reports a cancellation under way. */
  cancelRequested?: boolean;
  /** The CLI accepted the user's cancel request, so a failure must not be retried. */
  cancelAccepted?: boolean;
  /** The `executeDeployment` run that owns this deployment; others' outcomes are ignored. */
  executeRequestId?: string;
  createdAt: number;
  lastUpdated: number;
}

export interface DeploymentState {
  deployments: Record<string, Deployment>;
  history: Record<string, Deployment[]>;
}

interface InitializeDeploymentPayload {
  path: string;
  port: number;
  supportsDeployResource: boolean;
  hasCancelToken: boolean;
  wallet: string;
  chainId: ChainId;
}

interface UpdateDeploymentProgressPayload {
  path: string;
  deploymentId: string;
  state: DeployState;
}

interface UpdateDeploymentStatusPayload {
  path: string;
  deploymentId: string;
  componentsStatus: DeploymentComponentsStatus;
}

const initialState: DeploymentState = {
  deployments: {},
  history: {},
};

export const initializeDeployment = createAsyncThunk(
  'deployment/initialize',
  async (payload: InitializeDeploymentPayload, { rejectWithValue }) => {
    const { port } = payload;
    const url = getDeploymentUrl(port);

    if (!url) {
      return rejectWithValue(new DeploymentError('INVALID_URL', getInitialDeploymentStatus()));
    }

    const [info, files] = await Promise.all([fetchInfo(url), fetchFiles(url)]);

    return { ...payload, url, info, files };
  },
);

const updateDeploymentTarget = createAsyncThunk(
  'deployment/updateTarget',
  async (
    payload: {
      path: string;
      deploymentId: string;
      target: string;
      chainId: ChainId;
      wallet: string;
    },
    { rejectWithValue, getState },
  ) => {
    const { path, deploymentId, target, chainId, wallet } = payload;
    const { translation } = getState();

    const server = await editor.publishScene({
      target,
      path,
      chainId,
      wallet,
      language: translation.locale,
    });
    // The user published again meanwhile: the token and target belong to the newer deployment.
    if (getState().deployment.deployments[path]?.id !== deploymentId) {
      return rejectWithValue(
        new DeploymentError('DEPLOYMENT_NOT_FOUND', getInitialDeploymentStatus()),
      );
    }
    const { url, supportsDeployResource, hasCancelToken } = registerDeployServer(server);

    if (!url) {
      return rejectWithValue(new DeploymentError('INVALID_URL', getInitialDeploymentStatus()));
    }

    const [info, files] = await Promise.all([fetchInfo(url), fetchFiles(url)]);

    return { path, url, info, files, supportsDeployResource, hasCancelToken };
  },
);

export const deploy = createAsyncThunk(
  'deployment/deploy',
  async (
    { identity, deployment }: { identity: AuthIdentity; deployment: Deployment },
    { dispatch, getState, rejectWithValue },
  ) => {
    const { id: deploymentId, path, info, wallet, chainId } = deployment;
    const triedServers = new Set<string>();
    let retries = info.isWorld ? 1 : getCatalystServers(chainId).length;
    const delayMs = 1000;

    const onState = (state: DeployState) =>
      dispatch(actions.updateDeploymentProgress({ path, deploymentId, state }));

    // Whether the loop must stop retrying, read again after every await of the retry path.
    const getStopReason = () => {
      const current = getState().deployment.deployments[path];
      if (current?.id !== deploymentId) return { superseded: true as const };
      return current.cancelAccepted ? { cancelled: current.componentsStatus } : null;
    };

    let currentUrl = deployment.url;
    let currentInfo = info;
    while (retries > 0) {
      try {
        const authChain = Authenticator.signPayload(identity, currentInfo.rootCID);
        const payload = { address: wallet, authChain, chainId };
        // Each retry runs a new CLI, so read its support from the state. The static check can
        // be wrong (a hand-patched CLI), so the resource is also probed before using it.
        const { supportsDeployResource } = getState().deployment.deployments[path];
        if (supportsDeployResource && (await isDeployResourceAvailable(currentUrl))) {
          await deployWithProgress(currentUrl, payload, onState);
        } else {
          await deployFn(currentUrl, payload);
        }
        // Retrying against another catalyst rebuilds the scene and yields a new rootCID,
        // so the caller must poll the status of the entity that actually got deployed.
        return { info: currentInfo };
      } catch (error: any) {
        retries--;

        const currentDeployment = getState().deployment.deployments[path];
        // A newer deployment took over the path: deploying again would start a CLI over its one.
        if (currentDeployment?.id !== deploymentId) {
          return rejectWithValue(error);
        }
        // The user cancelled: a CLI that failed meanwhile must not be retried on another catalyst.
        if (isDeploymentError(error, 'DEPLOYMENT_CANCELLED') || currentDeployment.cancelAccepted) {
          return rejectWithValue(
            new DeploymentError('DEPLOYMENT_CANCELLED', currentDeployment.componentsStatus),
          );
        }

        const componentsStatus: DeploymentComponentsStatus = {
          ...currentDeployment.componentsStatus,
          catalyst: 'failed',
        };

        // The CLI accepted the deployment and may still publish it: deploying again, to this
        // or another catalyst, could publish the scene twice.
        if (isDeploymentError(error, 'DEPLOY_STATE_LOST')) {
          return rejectWithValue(
            new DeploymentError('DEPLOY_STATE_LOST', componentsStatus, error.error),
          );
        }

        if (isInvalidCreatorWalletError(error)) {
          return rejectWithValue(
            new DeploymentError('INVALID_CREATOR_WALLET', componentsStatus, error),
          );
        }

        if (isMaxPointerSizeExceededError(error)) {
          return rejectWithValue(
            new DeploymentError('MAX_POINTER_SIZE_EXCEEDED', componentsStatus, error),
          );
        }

        // Only the local CLI is requested here, so a timeout is the CLI not finishing in time.
        if (isFetchError(error, 'REQUEST_TIMEOUT')) {
          return rejectWithValue(
            new DeploymentError('DEPLOY_REQUEST_TIMEOUT', componentsStatus, error),
          );
        }

        if (isFetchError(error, 'NO_INTERNET_CONNECTION')) {
          return rejectWithValue(
            new DeploymentError('NO_INTERNET_CONNECTION', componentsStatus, error),
          );
        }

        if (retries <= 0) {
          return rejectWithValue(
            new DeploymentError('CATALYST_SERVERS_EXHAUSTED', componentsStatus, error),
          );
        }

        await delay(delayMs);

        // The answer to a cancel sent just before the failure may only arrive now.
        const stopAfterDelay = getStopReason();
        if (stopAfterDelay) {
          return rejectWithValue(
            'superseded' in stopAfterDelay
              ? error
              : new DeploymentError('DEPLOYMENT_CANCELLED', stopAfterDelay.cancelled),
          );
        }

        const selectedServer = getAvailableCatalystServer(triedServers, chainId);
        triedServers.add(selectedServer);

        const result = await dispatch(
          updateDeploymentTarget({ path, deploymentId, target: selectedServer, chainId, wallet }),
        ).unwrap();

        // Or while the next CLI was being built.
        const stopAfterTarget = getStopReason();
        if (stopAfterTarget) {
          return rejectWithValue(
            'superseded' in stopAfterTarget
              ? error
              : new DeploymentError('DEPLOYMENT_CANCELLED', stopAfterTarget.cancelled),
          );
        }

        currentUrl = result.url;
        currentInfo = result.info;
      }
    }

    // Unreachable in practice, but returning undefined here would fulfill the thunk and leave
    // the caller polling a deployment that never happened.
    return rejectWithValue(
      new DeploymentError(
        'CATALYST_SERVERS_EXHAUSTED',
        getState().deployment.deployments[path]?.componentsStatus ?? getInitialDeploymentStatus(),
      ),
    );
  },
);

export const executeDeployment = createAsyncThunk(
  'deployment/execute',
  async (path: string, { dispatch, signal, getState, rejectWithValue }) => {
    const deployment = getState().deployment.deployments[path];

    if (!deployment) {
      return rejectWithValue(
        new DeploymentError('DEPLOYMENT_NOT_FOUND', getInitialDeploymentStatus()),
      );
    }

    const { id: deploymentId, wallet } = deployment;

    const hasValidIdentity = AuthServerProvider.hasValidIdentity();
    const identity = localStorageGetIdentity(wallet);

    if (!hasValidIdentity || !identity) {
      AuthServerProvider.deactivate();
      const error = new DeploymentError('INVALID_IDENTITY', getInitialDeploymentStatus());
      captureException(error, {
        tags: { source: 'deployment', event: 'INVALID_IDENTITY', errorType: 'INVALID_IDENTITY' },
        fingerprint: ['deployment-error', 'INVALID_IDENTITY'],
      });
      return rejectWithValue(error);
    }

    try {
      // Retries against alternative catalysts rebuild the scene, so the deployed entity may
      // no longer be the one we started with. Poll the rootCID that actually got deployed.
      const { info } = await dispatch(deploy({ identity, deployment })).unwrap();

      // Read on every poll rather than once: flags are fetched asynchronously at startup and
      // this runs for up to an hour, so a late arrival still takes effect.
      const fetchStatus = () =>
        fetchDeploymentStatus(
          info,
          identity,
          getState().featureFlags.flags[FeatureFlag.ABGEN_PIPELINE] === true,
        );
      let hasFailed = false;
      const shouldAbort = () => signal.aborted || hasFailed;

      const onStatusChange = (componentsStatus: DeploymentComponentsStatus) => {
        hasFailed = deriveOverallStatus(componentsStatus) === 'failed';
        dispatch(actions.updateDeploymentStatus({ path, deploymentId, componentsStatus }));
      };

      const currentStatus = getInitialDeploymentStatus();
      const componentsStatus = await checkDeploymentStatus(
        maxRetries,
        retryDelayInMs,
        fetchStatus,
        onStatusChange,
        shouldAbort,
        currentStatus,
      );

      const finalStatus = deriveOverallStatus(componentsStatus);
      if (finalStatus === 'failed') {
        const error = new DeploymentError('DEPLOYMENT_FAILED', componentsStatus);
        captureException(error, {
          tags: {
            source: 'deployment',
            event: 'DEPLOYMENT_FAILED',
            errorType: 'DEPLOYMENT_FAILED',
          },
          fingerprint: ['deployment-error', 'DEPLOYMENT_FAILED'],
        });
        return rejectWithValue(error);
      } else if (finalStatus === 'complete') {
        dispatch(managementActions.fetchAllManagedProjectsData({ address: wallet }));
      }

      return { info, componentsStatus };
    } catch (error: any) {
      if (isDeploymentError(error, '*')) {
        if (error.name !== 'DEPLOYMENT_CANCELLED') {
          captureException(error.error || error, {
            tags: {
              source: 'deployment',
              event: error.name,
              errorType: error.name,
            },
            fingerprint: ['deployment-error', error.name],
          });
        }
        dispatch(
          actions.updateDeploymentStatus({
            path,
            deploymentId,
            componentsStatus: cleanPendingsFromDeploymentStatus(error.status),
          }),
        );
      }
      throw error;
    }
  },
);

/** Resolves with why the CLI turned the cancellation down, or `null` when it took it. */
export const cancelDeployment = createAsyncThunk(
  'deployment/cancel',
  async (path: string, { getState }) => {
    const deployment = getState().deployment.deployments[path];
    // No CLI to ask, so nothing can take the request.
    if (!deployment?.url) {
      return { deploymentId: deployment?.id, rejection: 'unauthorized' as const };
    }
    const rejection = await requestDeploymentCancel(deployment.url);
    return { deploymentId: deployment.id, rejection };
  },
);

/** Clears the CLI-reported progress, for a deployment that (re)starts or ends. */
function resetProgress(deployment: Deployment) {
  deployment.phase = undefined;
  deployment.upload = null;
  deployment.cancelRequested = false;
}

const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    updateDeploymentStatus: (state, action: PayloadAction<UpdateDeploymentStatusPayload>) => {
      const { path, deploymentId, componentsStatus } = action.payload;
      const deployment = state.deployments[path];

      // Only update if the deployment ID matches (prevents updating wrong deployment)
      if (deployment && deployment.id === deploymentId) {
        deployment.componentsStatus = componentsStatus;
        deployment.lastUpdated = Date.now();
      } else {
        // If deployment was moved to history, update it there
        const historyDeployments = state.history[path];
        if (historyDeployments) {
          const historyDeployment = historyDeployments.find(d => d.id === deploymentId);
          if (historyDeployment) {
            historyDeployment.componentsStatus = componentsStatus;
            historyDeployment.lastUpdated = Date.now();
          }
        }
      }
    },
    updateDeploymentProgress: (state, action: PayloadAction<UpdateDeploymentProgressPayload>) => {
      const { path, deploymentId, state: deployState } = action.payload;
      const deployment = state.deployments[path];
      if (deployment && deployment.id === deploymentId) {
        deployment.phase = deployState.phase;
        deployment.upload = deployState.upload;
        deployment.cancelRequested = deployState.cancelRequested ?? false;
        deployment.lastUpdated = Date.now();
      }
    },
    removeDeployment: (state, action: PayloadAction<{ path: string }>) => {
      const { path } = action.payload;
      delete state.deployments[path];
    },
    clearAllDeployments: state => {
      state.deployments = {};
    },
  },
  extraReducers: builder => {
    builder
      .addCase(initializeDeployment.fulfilled, (state, action) => {
        const { path, url, info, wallet, chainId, files, supportsDeployResource, hasCancelToken } =
          action.payload;
        const existingDeployment = state.deployments[path];

        // Move the existing deployment to history before creating the new one, unless the
        // user cancelled it: nothing got published.
        if (existingDeployment && existingDeployment.status !== 'cancelled') {
          if (!state.history[path]) {
            state.history[path] = [];
          }
          state.history[path].push(existingDeployment);
        }

        // Create new deployment
        const timestamp = Date.now();
        state.deployments[path] = {
          id: crypto.randomUUID(),
          path,
          url,
          info,
          files,
          wallet,
          chainId,
          status: 'idle',
          componentsStatus: getInitialDeploymentStatus(),
          supportsDeployResource,
          hasCancelToken,
          createdAt: timestamp,
          lastUpdated: timestamp,
        };
      })
      .addCase(updateDeploymentTarget.fulfilled, (state, action) => {
        const { path, url, info, files, supportsDeployResource, hasCancelToken } = action.payload;
        const deployment = state.deployments[path];
        // we are preserving componentsStatus, status, and error
        if (deployment?.id === action.meta.arg.deploymentId) {
          deployment.url = url;
          deployment.info = info;
          deployment.files = files;
          deployment.supportsDeployResource = supportsDeployResource;
          deployment.hasCancelToken = hasCancelToken;
          resetProgress(deployment);
          deployment.lastUpdated = Date.now();
        }
      })
      .addCase(initializeDeployment.rejected, (state, action) => {
        const { path, wallet, chainId } = action.meta.arg;
        const existingDeployment = state.deployments[path];
        const timestamp = Date.now();
        state.deployments[path] = {
          id: crypto.randomUUID(),
          path,
          url: '',
          info: { isWorld: false } as Info,
          files: [],
          wallet,
          chainId,
          status: 'failed',
          error: buildError(action),
          componentsStatus: getInitialDeploymentStatus(),
          supportsDeployResource: false,
          hasCancelToken: false,
          createdAt: existingDeployment?.createdAt ?? timestamp,
          lastUpdated: timestamp,
        };
      })
      .addCase(executeDeployment.pending, (state, action) => {
        const path = action.meta.arg;
        const deployment = state.deployments[path];
        if (deployment) {
          deployment.status = 'pending';
          deployment.executeRequestId = action.meta.requestId;
          deployment.cancelAccepted = false;
          resetProgress(deployment);
        }
      })
      .addCase(executeDeployment.fulfilled, (state, action) => {
        const path = action.meta.arg;
        const deployment = state.deployments[path];
        const { info, componentsStatus } = action.payload;
        if (deployment?.executeRequestId === action.meta.requestId) {
          deployment.info = info;
          deployment.status = 'complete';
          deployment.componentsStatus = componentsStatus;
          deployment.error = undefined;
          deployment.lastUpdated = Date.now();
        }
      })
      .addCase(executeDeployment.rejected, (state, action) => {
        const path = action.meta.arg;
        const deployment = state.deployments[path];
        // An orphaned run (the user published again) must not mark the newer deployment.
        if (deployment?.executeRequestId === action.meta.requestId) {
          const error = buildError(action);
          resetProgress(deployment);
          deployment.lastUpdated = Date.now();
          if (error?.name === 'DEPLOYMENT_CANCELLED') {
            deployment.status = 'cancelled';
            deployment.error = undefined;
          } else {
            deployment.status = 'failed';
            deployment.error = error;
          }
        }
      })
      .addCase(cancelDeployment.fulfilled, (state, action) => {
        const { deploymentId, rejection } = action.payload;
        const deployment = state.deployments[action.meta.arg];
        if (deployment && deployment.id === deploymentId && !rejection) {
          deployment.cancelAccepted = true;
        }
      });
  },
});

export const actions = {
  ...deploymentSlice.actions,
  initializeDeployment,
  executeDeployment,
  cancelDeployment,
};

export const reducer = deploymentSlice.reducer;
