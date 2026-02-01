import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit';
import { AuthServerProvider } from 'decentraland-connect';
import type { Async } from '/shared/types/async';
import type { WorldPermissionsResponse } from '/@/lib/worlds';
import { WorldPermissionType, Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import type {
  AddressPermissionPayload,
  ParcelsPermissionPayload,
  WorldPermissionsPayload,
} from './types';

export type ParcelsPermission = {
  parcels: string[];
  status: 'loading' | 'succeeded' | 'failed';
};

export type PermissionsState = {
  worldName: string;
  permissions: WorldPermissionsResponse | null;
  parcels: Record<string, ParcelsPermission>;
  loadingNewUser: boolean;
};

export const initialState: Async<PermissionsState> = {
  worldName: '',
  permissions: null,
  parcels: {},
  loadingNewUser: false,
  status: 'idle',
  error: null,
};

export const fetchWorldPermissions = createAsyncThunk(
  'permissions/fetchWorldPermissions',
  async ({ worldName }: { worldName: string }) => {
    const WorldsAPI = new Worlds();
    const worldPermissions = await WorldsAPI.getPermissions(worldName);
    return worldPermissions;
  },
);

export const updateWorldPermissions = createAsyncThunk(
  'permissions/updateWorldPermissions',
  async (
    { worldName, worldPermissionName, worldPermissionType }: WorldPermissionsPayload,
    { dispatch },
  ) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.postPermissionType(
      connectedAccount,
      worldName,
      worldPermissionName,
      worldPermissionType,
    );
    if (success) {
      await dispatch(fetchWorldPermissions({ worldName })).unwrap();
    } else {
      throw new Error('Failed to update world permissions');
    }
  },
);

export const addAddressPermission = createAsyncThunk(
  'permissions/addAddressPermission',
  async ({ worldName, permissionName, walletAddress }: AddressPermissionPayload, { dispatch }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.putPermissionType(
      connectedAccount,
      worldName,
      permissionName,
      walletAddress,
    );
    if (success) {
      await dispatch(fetchWorldPermissions({ worldName })).unwrap();
    } else {
      throw new Error('Failed to add address permission');
    }
  },
);

export const removeAddressPermission = createAsyncThunk(
  'permissions/removeAddressPermission',
  async ({ worldName, permissionName, walletAddress }: AddressPermissionPayload, { dispatch }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');
    const WorldsAPI = new Worlds();

    const success = await WorldsAPI.deletePermissionType(
      connectedAccount,
      worldName,
      permissionName,
      walletAddress,
    );
    if (success) {
      await dispatch(fetchWorldPermissions({ worldName })).unwrap();
    } else {
      throw new Error('Failed to remove address permission');
    }
  },
);

export const fetchParcelsPermission = createAsyncThunk(
  'permissions/fetchParcelsPermission',
  async ({ worldName, permissionName, walletAddress }: AddressPermissionPayload) => {
    const WorldsAPI = new Worlds();
    const parcels = await WorldsAPI.fetchParcelsPermission(
      worldName,
      permissionName,
      walletAddress,
    );
    return { walletAddress, parcels };
  },
);

export const addParcelsPermission = createAsyncThunk(
  'permissions/addParcelsPermission',
  async (
    { worldName, permissionName, walletAddress, parcels }: ParcelsPermissionPayload,
    { dispatch },
  ) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');
    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.postParcelsPermission(
      connectedAccount,
      worldName,
      permissionName,
      walletAddress,
      parcels,
    );
    if (success) {
      await dispatch(fetchWorldPermissions({ worldName })).unwrap();
    } else {
      throw new Error('Failed to add parcels permission');
    }
  },
);

export const removeParcelsPermission = createAsyncThunk(
  'permissions/removeParcelsPermission',
  async (
    { worldName, permissionName, walletAddress, parcels }: ParcelsPermissionPayload,
    { dispatch },
  ) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');
    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.deleteParcelsPermission(
      connectedAccount,
      worldName,
      permissionName,
      walletAddress,
      parcels,
    );
    if (success) {
      await dispatch(fetchWorldPermissions({ worldName })).unwrap();
    } else {
      throw new Error('Failed to remove parcels permission');
    }
  },
);

const slice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchWorldPermissions.pending, (state, action) => {
        state.worldName = action.meta.arg.worldName;
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchWorldPermissions.fulfilled, (state, action) => {
        state.permissions = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchWorldPermissions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch world permissions';
      })
      .addCase(addAddressPermission.pending, (state, action) => {
        const { walletAddress, permissionName } = action.meta.arg;
        if (
          state.permissions?.permissions[permissionName].type === WorldPermissionType.AllowList &&
          !state.permissions.permissions[permissionName].wallets?.includes(walletAddress)
        ) {
          // Only show loading state if the user is not already in the allow list.
          state.loadingNewUser = true;
        }
      })
      .addCase(addAddressPermission.fulfilled, state => {
        state.loadingNewUser = false;
      })
      .addCase(addAddressPermission.rejected, state => {
        state.loadingNewUser = false;
      })
      .addCase(fetchParcelsPermission.pending, (state, action) => {
        const { walletAddress } = action.meta.arg;
        state.parcels[walletAddress] = {
          parcels: state.parcels[walletAddress]?.parcels || [],
          status: 'loading',
        };
      })
      .addCase(fetchParcelsPermission.fulfilled, (state, action) => {
        const { walletAddress, parcels } = action.payload;
        state.parcels[walletAddress] = {
          parcels: parcels?.parcels || [],
          status: 'succeeded',
        };
      })
      .addCase(fetchParcelsPermission.rejected, (state, action) => {
        const { walletAddress } = action.meta.arg;
        if (state.parcels[walletAddress]) {
          state.parcels[walletAddress].status = 'failed';
        }
      });
  },
});

const getPermissionsState = (state: AppState) => state.permissions;

const getWorldPermissions = createSelector(
  getPermissionsState,
  permissionsState => permissionsState.permissions,
);

const getWorldName = createSelector(
  getPermissionsState,
  permissionsState => permissionsState.worldName,
);

const getStatus = createSelector(getPermissionsState, permissionsState => permissionsState.status);
const getError = createSelector(getPermissionsState, permissionsState => permissionsState.error);

const getParcelsStateForAddress = (
  state: AppState,
  walletAddress: string,
): ParcelsPermission | undefined => {
  return state.permissions.parcels[walletAddress];
};

export const actions = {
  ...slice.actions,
  fetchWorldPermissions,
  updateWorldPermissions,
  addAddressPermission,
  removeAddressPermission,
  fetchParcelsPermission,
  addParcelsPermission,
  removeParcelsPermission,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getPermissionsState,
  getWorldPermissions,
  getWorldName,
  getStatus,
  getError,
  getParcelsStateForAddress,
};
