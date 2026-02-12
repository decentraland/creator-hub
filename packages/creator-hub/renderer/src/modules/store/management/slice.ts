import {
  createAsyncThunk,
  createSlice,
  createSelector,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { ChainId } from '@dcl/schemas';
import { AuthServerProvider } from 'decentraland-connect';
import type { Async } from '/shared/types/async';
import type { ManagedProject } from '/shared/types/manage';
import { FilterBy } from '/shared/types/manage';
import { ManagedProjectType, SortBy } from '/shared/types/manage';
import type {
  WorldScene,
  WorldSettings,
  WorldsWalletStats,
  WorldPermissionsResponse,
  WorldPermissions,
} from '/@/lib/worlds';
import { WorldRoleType, Worlds, WorldPermissionType } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList } from '/@/modules/store/land';
import type { AccountHoldings } from '/@/lib/account';
import { Account } from '/@/lib/account';
import {
  getThumbnailUrlFromDeployment,
  getWorldPermissionsInitialState,
  getWorldSettingsInitialState,
} from './utils';
import type {
  AddressPermissionPayload,
  ParcelsPermissionPayload,
  WorldPermissionsPayload,
} from './types';

export type ParcelsPermission = {
  parcels: string[];
  status: 'loading' | 'succeeded' | 'failed';
};

export type WorldSettingsState = {
  worldName: string;
  settings: WorldSettings;
  scenes: WorldScene[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

export type WorldPermissionsState = {
  worldName: string;
  owner: string;
  summary: WorldPermissionsResponse['summary'];
  permissions: WorldPermissions | null;
  parcels: Record<string, ParcelsPermission>;
  loadingNewUser: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

// state
export type ManagementState = {
  sortBy: SortBy;
  publishFilter: FilterBy;
  searchQuery: string;
  page: number;
  total: number;
  projects: ManagedProject[];
  storageStats: WorldsWalletStats | null;
  accountHoldings: AccountHoldings | null;
  worldSettings: WorldSettingsState;
  worldPermissions: WorldPermissionsState;
};

export const initialState: Async<ManagementState> = {
  sortBy: SortBy.LATEST,
  publishFilter: FilterBy.PUBLISHED,
  searchQuery: '',
  page: 0,
  total: 0,
  projects: [],
  storageStats: null,
  accountHoldings: null,
  status: 'idle',
  error: null,
  worldSettings: getWorldSettingsInitialState(),
  worldPermissions: getWorldPermissionsInitialState(),
};

const PROJECTS_PAGE_LIMIT = 50;

// thunks
/** Gets all user ENS, LANDs, storage stats and filtered managed projects */
export const fetchAllManagedProjectsData = createAsyncThunk(
  'management/fetchAllManagedProjectsData',
  async ({ address, chainId }: { address: string; chainId: ChainId }, { dispatch }) => {
    // Fetch NAMEs and Land parcels/estates in parallel.
    await Promise.all([
      dispatch(fetchENSList({ address, chainId })).unwrap(),
      dispatch(fetchLandList({ address })).unwrap(),
    ]);

    const [projects] = await Promise.all([
      dispatch(fetchManagedProjectsFiltered()).unwrap(),
      dispatch(fetchStorageStats({ address })).unwrap(),
      dispatch(fetchAccountHoldings({ address })).unwrap(),
    ]);

    return projects;
  },
);

/** Fetches managed projects according to current filters in the state */
export const fetchManagedProjectsFiltered = createAsyncThunk(
  'management/fetchManagedProjectsWithFilters',
  async (_, { dispatch, getState }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const state = getState() as AppState;
    if (state.management.publishFilter === FilterBy.PUBLISHED) {
      await dispatch(fetchWorlds({ address: connectedAccount })).unwrap();
    } else if (state.management.publishFilter === FilterBy.UNPUBLISHED) {
      await dispatch(fetchEmptyWorlds({ address: connectedAccount })).unwrap();
    }
  },
);

/** Fetches published worlds (world settings configured) where the user is an owner or collaborator */
export const fetchWorlds = createAsyncThunk(
  'management/fetchWorlds',
  async ({ address }: { address: string }, { getState }) => {
    const appState = getState() as AppState;
    const WorldsAPI = new Worlds();

    const worldsResponse = await WorldsAPI.fetchWorlds({
      limit: PROJECTS_PAGE_LIMIT,
      search: appState.management.searchQuery,
      sort: appState.management.sortBy,
      authorized_deployer: address,
      offset: PROJECTS_PAGE_LIMIT * appState.management.page,
    });
    if (worldsResponse === null) {
      throw new Error('Failed to fetch worlds');
    }

    const worldProjects: ManagedProject[] = worldsResponse.worlds.map(world => ({
      id: world.name,
      displayName: world.name,
      type: ManagedProjectType.WORLD,
      role:
        world.owner.toLowerCase() === address.toLowerCase()
          ? WorldRoleType.OWNER
          : WorldRoleType.COLLABORATOR,
      deployment: {
        title: world.title || '',
        description: world.description || '',
        thumbnail: world.thumbnailHash ? WorldsAPI.getContentSrcUrl(world.thumbnailHash) : '',

        lastPublishedAt: world.lastDeployedAt ? new Date(world.lastDeployedAt).getTime() : 0,
        scenesCount: world.deployedScenes || 0,
      },
    }));

    return { worlds: worldProjects, total: worldsResponse.total };
  },
);

/** Fetches unpublished worlds (0 published scenes) where the user is an owner or collaborator */
export const fetchEmptyWorlds = createAsyncThunk(
  'management/fetchEmptyWorlds',
  async ({ address }: { address: string }, { getState }) => {
    const state = getState() as AppState;
    const ensList = Object.values(state.ens.data);

    const emptyProjects: ManagedProject[] = ensList
      .filter(ens => !ens.worldStatus?.scene.entityId)
      .map(ens => ({
        id: ens.subdomain,
        displayName: ens.subdomain,
        role:
          ens.nftOwnerAddress && ens.nftOwnerAddress?.toLowerCase() === address?.toLowerCase()
            ? WorldRoleType.OWNER
            : WorldRoleType.COLLABORATOR,
        type: ManagedProjectType.WORLD,
        deployment: undefined,
      }));

    return emptyProjects;
  },
);

export const fetchStorageStats = createAsyncThunk(
  'management/fetchStorageStats',
  async ({ address }: { address: string }) => {
    const WorldsAPI = new Worlds();
    const stats = await WorldsAPI.fetchWalletStats(address);
    return stats;
  },
);

export const fetchAccountHoldings = createAsyncThunk(
  'management/fetchAccountHoldings',
  async ({ address }: { address: string }) => {
    const AccountAPI = new Account();
    const holdings = await AccountAPI.fetchAccountHoldings(address);
    return holdings;
  },
);

export const fetchWorldSettings = createAsyncThunk(
  'management/fetchWorldSettings',
  async ({ worldName }: { worldName: string }) => {
    const WorldsAPI = new Worlds();
    const worldSettings = await WorldsAPI.fetchWorldSettings(worldName);
    return worldSettings;
  },
);

export const updateWorldSettings = createAsyncThunk(
  'management/updateWorldSettings',
  async (
    { worldName, worldSettings }: { worldName: string; worldSettings: Partial<WorldSettings> },
    { dispatch, rejectWithValue },
  ) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const WorldsAPI = new Worlds();
    const { success, error } = await WorldsAPI.putWorldSettings(
      connectedAccount,
      worldName,
      worldSettings,
    );
    if (!success) return rejectWithValue({ message: error });
    await dispatch(fetchWorldSettings({ worldName })).unwrap();
    dispatch(fetchManagedProjectsFiltered()).unwrap();
  },
);

export const fetchWorldScenes = createAsyncThunk(
  'management/fetchWorldScenes',
  async ({ worldName }: { worldName: string }) => {
    const WorldsAPI = new Worlds();
    const worldScenes = await WorldsAPI.fetchWorldScenes(worldName);
    return (
      worldScenes?.scenes.map(scene => ({
        ...scene,
        thumbnailUrl: getThumbnailUrlFromDeployment(scene.entity, $ =>
          WorldsAPI.getContentSrcUrl($),
        ),
      })) ?? []
    );
  },
);

export const unpublishWorld = createAsyncThunk(
  'management/unpublishWorld',
  async ({ address, worldName }: { address: string; worldName: string }) => {
    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.unpublishWorld(address, worldName);
    return success;
  },
);

export const unpublishWorldScene = createAsyncThunk(
  'management/unpublishWorldScene',
  async ({ worldName, sceneCoord }: { worldName: string; sceneCoord: string }, { dispatch }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.unpublishWorldScene(connectedAccount, worldName, sceneCoord);
    if (success) {
      await dispatch(fetchWorldScenes({ worldName })).unwrap();
    } else {
      throw new Error('Failed to unpublish world scene');
    }
  },
);

export const unpublishEntireWorld = createAsyncThunk(
  'management/unpublishEntireWorld',
  async ({ address, worldName }: { address: string; worldName: string }) => {
    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.unpublishEntireWorld(address, worldName);
    return success;
  },
);

export const fetchWorldPermissions = createAsyncThunk(
  'management/fetchWorldPermissions',
  async ({ worldName }: { worldName: string }) => {
    const WorldsAPI = new Worlds();
    const worldPermissions = await WorldsAPI.getPermissions(worldName);
    return worldPermissions;
  },
);

export const updateWorldPermissions = createAsyncThunk(
  'management/updateWorldPermissions',
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
  'management/addAddressPermission',
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
  'management/removeAddressPermission',
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
  'management/fetchParcelsPermission',
  async ({ worldName, permissionName, walletAddress }: AddressPermissionPayload) => {
    const WorldsAPI = new Worlds();
    const LIMIT = 100;

    // TODO: This is a workaround to fetch all parcels in parallel.
    // We should use a more efficient approach to avoid overloading the API.
    const firstPage = await WorldsAPI.fetchParcelsPermission(
      worldName,
      permissionName,
      walletAddress,
      { limit: LIMIT, offset: 0 },
    );

    if (!firstPage || firstPage.total <= LIMIT) {
      return { walletAddress, parcels: firstPage };
    }

    const totalPages = Math.ceil(firstPage.total / LIMIT);
    const remainingPagesPromises = Array.from({ length: totalPages - 1 }, (_, page) =>
      WorldsAPI.fetchParcelsPermission(worldName, permissionName, walletAddress, {
        limit: LIMIT,
        offset: (page + 1) * LIMIT,
      }),
    );

    const pages = await Promise.all(remainingPagesPromises);
    const allParcels = [...firstPage.parcels, ...pages.flatMap(p => p?.parcels || [])];

    return {
      walletAddress,
      parcels: { parcels: allParcels, total: firstPage.total },
    };
  },
);

export const addParcelsPermission = createAsyncThunk(
  'management/addParcelsPermission',
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
  'management/removeParcelsPermission',
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

// slice
const slice = createSlice({
  name: 'management',
  initialState,
  reducers: {
    setSortBy: (state, action: PayloadAction<SortBy>) => {
      state.sortBy = action.payload;
      state.page = 0;
    },
    setPublishFilter: (state, action: PayloadAction<FilterBy>) => {
      state.publishFilter = action.payload;
      state.page = 0;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.page = 0;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    clearPermissionsState: state => {
      state.worldPermissions = getWorldPermissionsInitialState();
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAllManagedProjectsData.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsData.fulfilled, state => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch managed projects';
      })
      .addCase(fetchWorlds.fulfilled, (state, action) => {
        state.projects =
          state.page === 0
            ? (action.payload.worlds ?? []) // If it's the first page, replace the projects with the new ones.
            : [...state.projects, ...(action.payload.worlds ?? [])]; //  Otherwise, append them to the existing list.
        state.total = action.payload.total;
      })
      .addCase(fetchEmptyWorlds.fulfilled, (state, action) => {
        state.projects = action.payload ?? []; // Not paginated.
        state.total = action.payload.length;
      })
      .addCase(fetchStorageStats.fulfilled, (state, action) => {
        state.storageStats = action.payload;
      })
      .addCase(fetchAccountHoldings.fulfilled, (state, action) => {
        state.accountHoldings = action.payload;
      })
      .addCase(fetchWorldScenes.pending, (state, action) => {
        state.worldSettings.worldName = action.meta.arg.worldName;
      })
      .addCase(fetchWorldScenes.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.scenes = action.payload ?? [];
      })
      .addCase(fetchWorldSettings.pending, (state, action) => {
        if (state.worldSettings.worldName !== action.meta.arg.worldName) {
          state.worldSettings.settings = {} as WorldSettings;
        }
        state.worldSettings.worldName = action.meta.arg.worldName;
        state.worldSettings.status = 'loading';
        state.worldSettings.error = null;
      })
      .addCase(fetchWorldSettings.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.settings = action.payload ?? {};
        state.worldSettings.status = 'succeeded';
        state.worldSettings.error = null;
      })
      .addCase(updateWorldSettings.rejected, (state, action) => {
        state.worldSettings.status = 'failed';
        state.worldSettings.error = action.error.message || 'Failed to save world settings';
      })
      .addCase(fetchWorldSettings.rejected, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.status = 'failed';
        state.worldSettings.error = action.error.message || 'Failed to fetch world settings';
      })
      .addCase(fetchWorldPermissions.pending, (state, action) => {
        const prevWorldName = state.worldPermissions.worldName;
        const newWorldName = action.meta.arg.worldName;
        if (prevWorldName && newWorldName !== prevWorldName) {
          state.worldPermissions = getWorldPermissionsInitialState(); // Reset state when switching worlds
        }
        state.worldPermissions.worldName = newWorldName;
        state.worldPermissions.status = 'loading';
        state.worldPermissions.error = null;
      })
      .addCase(fetchWorldPermissions.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldPermissions.worldName) return;
        if (action.payload !== null) {
          const { permissions, summary, owner } = action.payload;
          state.worldPermissions.permissions = permissions;
          state.worldPermissions.summary = summary;
          state.worldPermissions.owner = owner || '';
          state.worldPermissions.status = 'succeeded';
          state.worldPermissions.error = null;
        } else {
          state.worldPermissions.status = 'failed';
          state.worldPermissions.error = 'Failed to fetch world permissions';
        }
      })
      .addCase(fetchWorldPermissions.rejected, (state, action) => {
        state.worldPermissions.status = 'failed';
        state.worldPermissions.error = action.error.message || 'Failed to fetch world permissions';
      })
      .addCase(addAddressPermission.pending, (state, action) => {
        const { walletAddress, permissionName } = action.meta.arg;
        const permissionData = state.worldPermissions.permissions?.[permissionName];
        if (
          permissionData &&
          permissionData.type === WorldPermissionType.AllowList &&
          !permissionData.wallets?.includes(walletAddress)
        ) {
          // Only show loading state if the user is not already in the allow list.
          state.worldPermissions.loadingNewUser = true;
        }
      })
      .addCase(addAddressPermission.fulfilled, state => {
        state.worldPermissions.loadingNewUser = false;
      })
      .addCase(addAddressPermission.rejected, state => {
        state.worldPermissions.loadingNewUser = false;
      })
      .addCase(fetchParcelsPermission.pending, (state, action) => {
        const { walletAddress, worldName } = action.meta.arg;
        state.worldPermissions.worldName = worldName;
        state.worldPermissions.parcels[walletAddress] = {
          parcels: state.worldPermissions.parcels[walletAddress]?.parcels || [],
          status: 'loading',
        };
      })
      .addCase(fetchParcelsPermission.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldPermissions.worldName) return;
        const { walletAddress, parcels } = action.payload;
        state.worldPermissions.parcels[walletAddress] = {
          parcels: parcels?.parcels || [],
          status: 'succeeded',
        };
      })
      .addCase(fetchParcelsPermission.rejected, (state, action) => {
        if (action.meta.arg.worldName !== state.worldPermissions.worldName) return;
        const { walletAddress } = action.meta.arg;
        if (state.worldPermissions.parcels[walletAddress]) {
          state.worldPermissions.parcels[walletAddress].status = 'failed';
        }
      });
  },
});

// selectors
const getManagementState = (state: AppState) => state.management;
const getManagedProjects = createSelector(
  getManagementState,
  managementState => managementState.projects,
);

const getWorldSettings = createSelector(
  getManagementState,
  managementState => managementState.worldSettings,
);

const getWorldScenes = createSelector(
  getManagementState,
  managementState => managementState.worldSettings.scenes,
);

const getError = createSelector(getManagementState, managementState => managementState.error);

const getPermissionsState = createSelector(
  getManagementState,
  managementState => managementState.worldPermissions,
);

const getParcelsStateForAddress = (
  state: AppState,
  walletAddress: string,
): ParcelsPermission | undefined => {
  return state.management.worldPermissions.parcels[walletAddress];
};

// exports
export const actions = {
  ...slice.actions,
  fetchAllManagedProjectsData,
  fetchManagedProjectsFiltered,
  fetchWorlds,
  fetchEmptyWorlds,
  fetchWorldSettings,
  updateWorldSettings,
  fetchStorageStats,
  fetchAccountHoldings,
  fetchWorldScenes,
  unpublishWorldScene,
  unpublishWorld,
  fetchWorldPermissions,
  updateWorldPermissions,
  addAddressPermission,
  removeAddressPermission,
  fetchParcelsPermission,
  addParcelsPermission,
  removeParcelsPermission,
  unpublishEntireWorld,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getManagedProjects,
  getWorldSettings,
  getWorldScenes,
  getError,
  getPermissionsState,
  getParcelsStateForAddress,
};
