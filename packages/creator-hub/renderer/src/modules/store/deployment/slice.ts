import { createSlice, type PayloadAction, isRejectedWithValue } from '@reduxjs/toolkit';
import { Authenticator, type AuthIdentity } from '@dcl/crypto';
import type { ChainId } from '@dcl/schemas';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';

import type { DeploymentComponentsStatus, Info, Status, File } from '/@/lib/deploy';
import { DeploymentError, DeploymentErrorType, isDeploymentError } from '/@/lib/deploy';
import { delay } from '/shared/utils';

import { createAsyncThunk } from '/@/modules/store/thunk';

import { publishScene } from '/@/modules/store/editor/slice';
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
} from './utils';

const getErrorForTranslation = (action: any) =>
  isRejectedWithValue(action) ? action.payload : action.error;

const getCauseMessage = (action: any): string | undefined => {
  if (isRejectedWithValue(action)) {
    return action.payload?.message;
  }
  return action.error?.message;
};

export interface Deployment {
  path: string;
  url: string;
  info: Info;
  files: File[];
  wallet: string;
  chainId: ChainId;
  identity: AuthIdentity;
  status: Status;
  error?: { message: string; cause?: string };
  componentsStatus: DeploymentComponentsStatus;
  lastUpdated: number;
}

export interface DeploymentState {
  deployments: Record<string, Deployment>;
}

interface InitializeDeploymentPayload {
  path: string;
  port: number;
  wallet: string;
  chainId: ChainId;
}

interface UpdateDeploymentStatusPayload {
  path: string;
  componentsStatus: DeploymentComponentsStatus;
}

const initialState: DeploymentState = {
  deployments: {},
};

export const initializeDeployment = createAsyncThunk(
  'deployment/initialize',
  async (payload: InitializeDeploymentPayload, { rejectWithValue }) => {
    const { port, wallet } = payload;
    const url = getDeploymentUrl(port);

    if (!url) {
      return rejectWithValue(
        new DeploymentError(DeploymentErrorType.INVALID_URL, getInitialDeploymentStatus()),
      );
    }

    const identity = localStorageGetIdentity(wallet);

    if (!identity) {
      return rejectWithValue(
        new DeploymentError(DeploymentErrorType.INVALID_IDENTITY, getInitialDeploymentStatus()),
      );
    }

    const [info, files] = await Promise.all([fetchInfo(url), fetchFiles(url)]);

    return { ...payload, url, info, files, identity };
  },
);

export const deploy = createAsyncThunk(
  'deployment/deploy',
  async (deployment: Deployment, { dispatch, rejectWithValue }) => {
    const { path, info, identity, url, wallet, chainId } = deployment;
    const authChain = Authenticator.signPayload(identity, info.rootCID);
    const triedServers = new Set<string>();
    let retries = getCatalystServers(chainId).length;
    const delayMs = 1000;

    while (retries > 0) {
      try {
        return await deployFn(url, { address: wallet, authChain, chainId });
      } catch (error: any) {
        retries--;
        if (retries <= 0) {
          const componentsStatus: DeploymentComponentsStatus = {
            ...deployment.componentsStatus,
            catalyst: 'failed',
          };
          return rejectWithValue(
            new DeploymentError(
              DeploymentErrorType.CATALYST_SERVERS_EXHAUSTED,
              componentsStatus,
              error,
            ),
          );
        }

        await delay(delayMs);

        const selectedServer = getAvailableCatalystServer(triedServers, chainId);
        triedServers.add(selectedServer);

        await dispatch(publishScene({ path, target: selectedServer, chainId, wallet })).unwrap();
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
        new DeploymentError(DeploymentErrorType.DEPLOYMENT_NOT_FOUND, getInitialDeploymentStatus()),
      );
    }

    const { info, identity } = deployment;

    try {
      await dispatch(deploy(deployment)).unwrap();

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
        return rejectWithValue(
          new DeploymentError(DeploymentErrorType.DEPLOYMENT_FAILED, componentsStatus),
        );
      }

      return { info, componentsStatus };
    } catch (error: any) {
      if (isDeploymentError(error, '*')) {
        dispatch(
          actions.updateDeploymentStatus({
            path,
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
        const { path, url, info, wallet, chainId, files, identity } = action.payload;
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
          identity,
        };
      })
      .addCase(initializeDeployment.rejected, (state, action) => {
        const { path, wallet, chainId } = action.meta.arg;
        state.deployments[path] = {
          path,
          url: '',
          info: { isWorld: false } as Info,
          files: [],
          wallet,
          chainId,
          status: 'failed',
          error: {
            message: translateError(getErrorForTranslation(action)),
            cause: getCauseMessage(action),
          },
          componentsStatus: getInitialDeploymentStatus(),
          lastUpdated: Date.now(),
          identity: {} as AuthIdentity,
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
          deployment.error = {
            message: translateError(getErrorForTranslation(action)),
            cause: getCauseMessage(action),
          };
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
