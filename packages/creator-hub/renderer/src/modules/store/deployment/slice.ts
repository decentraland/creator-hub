import { createSlice, type PayloadAction, isRejectedWithValue } from '@reduxjs/toolkit';
import { Authenticator, type AuthIdentity } from '@dcl/crypto';
import type { ChainId } from '@dcl/schemas';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { AuthServerProvider } from '/@/lib/auth';

import { editor } from '#preload';
import { delay } from '/shared/utils';
import { isFetchError } from '/shared/fetch';
import type { DeploymentComponentsStatus, Info, Status, File, ErrorName } from '/@/lib/deploy';
import { DeploymentError, isDeploymentError } from '/@/lib/deploy';
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
  status: Status;
  error?: { name: ErrorName; message: string; cause?: string };
  componentsStatus: DeploymentComponentsStatus;
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
  wallet: string;
  chainId: ChainId;
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
    payload: { path: string; target: string; chainId: ChainId; wallet: string },
    { rejectWithValue, getState },
  ) => {
    const { path, target, chainId, wallet } = payload;
    const { translation } = getState();

    const port = await editor.publishScene({
      target,
      path,
      chainId,
      wallet,
      language: translation.locale,
    });
    const url = getDeploymentUrl(port);

    if (!url) {
      return rejectWithValue(new DeploymentError('INVALID_URL', getInitialDeploymentStatus()));
    }

    const [info, files] = await Promise.all([fetchInfo(url), fetchFiles(url)]);

    return { path, url, info, files };
  },
);

export const deploy = createAsyncThunk(
  'deployment/deploy',
  async (
    { identity, deployment }: { identity: AuthIdentity; deployment: Deployment },
    { dispatch, getState, rejectWithValue },
  ) => {
    const { path, info, wallet, chainId } = deployment;
    const triedServers = new Set<string>();
    let retries = info.isWorld ? 1 : getCatalystServers(chainId).length;
    const delayMs = 1000;

    let currentUrl = deployment.url;
    let currentInfo = info;
    while (retries > 0) {
      try {
        const authChain = Authenticator.signPayload(identity, currentInfo.rootCID);
        return await deployFn(currentUrl, { address: wallet, authChain, chainId });
      } catch (error: any) {
        retries--;

        const currentDeployment = getState().deployment.deployments[path];
        const componentsStatus: DeploymentComponentsStatus = {
          ...currentDeployment.componentsStatus,
          catalyst: 'failed',
        };

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

        if (isFetchError(error, 'REQUEST_TIMEOUT')) {
          return rejectWithValue(
            new DeploymentError('FETCH_TIMEOUT_ERROR', componentsStatus, error),
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

        const selectedServer = getAvailableCatalystServer(triedServers, chainId);
        triedServers.add(selectedServer);

        const result = await dispatch(
          updateDeploymentTarget({ path, target: selectedServer, chainId, wallet }),
        ).unwrap();

        currentUrl = result.url;
        currentInfo = result.info;
      }
    }
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

    const { info, id: deploymentId, wallet } = deployment;

    const hasValidIdentity = AuthServerProvider.hasValidIdentity();
    const identity = localStorageGetIdentity(wallet);

    if (!hasValidIdentity || !identity) {
      AuthServerProvider.deactivate();
      return rejectWithValue(new DeploymentError('INVALID_IDENTITY', getInitialDeploymentStatus()));
    }

    try {
      await dispatch(deploy({ identity, deployment })).unwrap();

      const fetchStatus = () => fetchDeploymentStatus(info, identity);
      let isCancelled = false;
      const shouldAbort = () => signal.aborted || isCancelled;

      const onStatusChange = (componentsStatus: DeploymentComponentsStatus) => {
        isCancelled = deriveOverallStatus(componentsStatus) === 'failed';
        dispatch(actions.updateDeploymentStatus({ path, deploymentId, componentsStatus }));
      };

      const currentStatus = getInitialDeploymentStatus(info.isWorld);
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
        return rejectWithValue(new DeploymentError('DEPLOYMENT_FAILED', componentsStatus));
      } else if (finalStatus === 'complete') {
        dispatch(managementActions.fetchAllManagedProjectsData({ address: wallet }));
      }

      return { info, componentsStatus };
    } catch (error: any) {
      if (isDeploymentError(error, '*')) {
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
        const { path, url, info, wallet, chainId, files } = action.payload;
        const existingDeployment = state.deployments[path];

        // Always move existing deployment to history before creating new one
        if (existingDeployment) {
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
          componentsStatus: getInitialDeploymentStatus(info.isWorld),
          createdAt: timestamp,
          lastUpdated: timestamp,
        };
      })
      .addCase(updateDeploymentTarget.fulfilled, (state, action) => {
        const { path, url, info, files } = action.payload;
        const deployment = state.deployments[path];
        // we are preserving componentsStatus, status, and error
        if (deployment) {
          deployment.url = url;
          deployment.info = info;
          deployment.files = files;
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
          createdAt: existingDeployment?.createdAt ?? timestamp,
          lastUpdated: timestamp,
        };
      })
      .addCase(executeDeployment.pending, (state, action) => {
        const path = action.meta.arg;
        const deployment = state.deployments[path];
        if (deployment) {
          deployment.status = 'pending';
        }
      })
      .addCase(executeDeployment.fulfilled, (state, action) => {
        const path = action.meta.arg;
        const deployment = state.deployments[path];
        const { info, componentsStatus } = action.payload;
        if (deployment) {
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
        if (deployment) {
          deployment.status = 'failed';
          deployment.error = buildError(action);
          deployment.lastUpdated = Date.now();
        }
      });
  },
});

export const actions = {
  ...deploymentSlice.actions,
  initializeDeployment,
  executeDeployment,
};

export const reducer = deploymentSlice.reducer;
