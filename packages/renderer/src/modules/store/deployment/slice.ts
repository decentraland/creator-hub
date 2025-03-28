import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { Authenticator } from '@dcl/crypto';
import type { ChainId } from '@dcl/schemas';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';

import type { DeploymentComponentsStatus, Info, Status } from '/shared/types/deploy';
import { isDeploymentError } from '/shared/types/deploy';

import { createAsyncThunk } from '/@/modules/store/thunk';

import { dispatchWithRetry } from '/@/modules/store/utils';
import { publishScene } from '/@/modules/store/editor/slice';
import {
  checkDeploymentStatus,
  cleanPendingsFromDeploymentStatus,
  deriveOverallStatus,
  fetchDeploymentStatus,
  getInitialDeploymentStatus,
  retryDelayInMs,
  maxRetries,
  deploy,
  getDeploymentUrl,
  fetchInfo,
  fetchFiles,
  getAvailableCatalystServer,
} from './utils';

export interface Deployment {
  path: string;
  url: string;
  info: Info;
  files: File[];
  wallet: string;
  chainId: ChainId;
  status: Status;
  error?: string;
  componentsStatus: DeploymentComponentsStatus;
  lastUpdated: number;
}

export interface DeploymentState {
  deployments: Record<string, Deployment>;
}

interface UpdateDeploymentStatusPayload {
  path: string;
  componentsStatus: DeploymentComponentsStatus;
}

const initialState: DeploymentState = {
  deployments: {},
};

export const initializeDeployment = createAsyncThunk<
  { path: string; url: string; info: Info; wallet: string; chainId: ChainId; files: File[] },
  { path: string; port: number; wallet: string; chainId: ChainId },
  { rejectValue: { message: string; info: Info } }
>('deployment/initialize', async (payload, { rejectWithValue }) => {
  const { path, port, wallet, chainId } = payload;
  const url = getDeploymentUrl(port);
  if (!url) {
    return rejectWithValue({ message: 'Invalid URL', info: {} as Info });
  }
  const [info, files] = await Promise.all([fetchInfo(url), fetchFiles(url)]);
  return { path, url, info, wallet, chainId, files };
});

export const executeDeployment = createAsyncThunk<
  { info: Info; componentsStatus: DeploymentComponentsStatus },
  string,
  { rejectValue: { message: string; info: Info } }
>('deployment/execute', async (path, { dispatch, signal, rejectWithValue, getState }) => {
  const deployment = getState().deployment.deployments[path];

  if (!deployment) {
    return rejectWithValue({
      message: 'Deployment not found. Initialize it first.',
      info: {} as Info,
    });
  }

  const { url, info, wallet, chainId } = deployment;

  try {
    const identity = localStorageGetIdentity(wallet);
    if (!identity) {
      return rejectWithValue({ message: 'Invalid identity', info });
    }
    const authChain = Authenticator.signPayload(identity, info.rootCID);
    await deploy(url, { address: wallet, authChain, chainId });

    const fetchStatus = () => fetchDeploymentStatus(info, identity);
    let isCancelled = false;
    const shouldAbort = () => signal.aborted || isCancelled;

    const onStatusChange = (componentsStatus: DeploymentComponentsStatus) => {
      isCancelled = deriveOverallStatus(componentsStatus) === 'failed';
      dispatch(actions.updateDeploymentStatus({ path, componentsStatus }));
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

    if (deriveOverallStatus(componentsStatus) === 'failed') {
      return rejectWithValue({ message: 'Deployment failed', info });
    }

    return { info, componentsStatus };
  } catch (error) {
    if (isDeploymentError(error, 'MAX_RETRIES')) {
      dispatch(
        actions.updateDeploymentStatus({
          path,
          componentsStatus: cleanPendingsFromDeploymentStatus(error.status),
        }),
      );
    }
    return rejectWithValue({
      message: error instanceof Error ? error.message : 'Unknown error',
      info,
    });
  }
});

export const executeDeploymentWithRetry = createAsyncThunk<
  { info: Info; componentsStatus: DeploymentComponentsStatus },
  string,
  { rejectValue: { message: string; info: Info } }
>('deployment/executeWithRetry', async (path, { dispatch, rejectWithValue, getState }) => {
  const deployment = getState().deployment.deployments[path];
  if (!deployment) {
    return rejectWithValue({
      message: 'Deployment not found. Initialize it first.',
      info: {} as Info,
    });
  }

  const { wallet, chainId } = deployment;
  const triedServers = new Set<string>();

  const result = await dispatchWithRetry(dispatch, executeDeployment, path, {
    maxRetries: 3,
    delayMs: 1000,
    shouldRetry: (_error, attempt) => triedServers.size <= attempt,
    onFailure: async () => {
      const selectedServer = getAvailableCatalystServer(triedServers, chainId);
      triedServers.add(selectedServer);

      const port = await dispatch(publishScene({ path, target: selectedServer })).unwrap();

      await dispatch(
        initializeDeployment({
          path,
          port,
          chainId,
          wallet,
        }),
      ).unwrap();
    },
  });
  return result;
});

const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    updateDeploymentStatus: (state, action: PayloadAction<UpdateDeploymentStatusPayload>) => {
      const { path, componentsStatus } = action.payload;
      const deployment = state.deployments[path];
      if (deployment) {
        deployment.componentsStatus = componentsStatus;
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
        const { path, url, info, wallet, chainId, files } = action.payload;
        state.deployments[path] = {
          path,
          url,
          info,
          files,
          wallet,
          chainId,
          status: 'idle',
          componentsStatus: getInitialDeploymentStatus(info.isWorld),
          lastUpdated: Date.now(),
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
          deployment.error = action.payload?.message || 'Unknown error';
          deployment.lastUpdated = Date.now();
        }
      });
  },
});

export const actions = {
  ...deploymentSlice.actions,
  initializeDeployment,
  executeDeployment,
  executeDeploymentWithRetry,
};

export const reducer = deploymentSlice.reducer;
