import { createSlice, createSelector, isPending, type PayloadAction } from '@reduxjs/toolkit';
import pLimit from 'p-limit';
import type { Async } from '/shared/types/async';
import type { ManagedProject, ManageTab } from '/shared/types/manage';
import { FilterBy } from '/shared/types/manage';
import { ManagedProjectType, SortBy } from '/shared/types/manage';
import { AuthServerProvider } from '/@/lib/auth';
import type { LandDeployment } from '/@/lib/land';
import { Lands, ownedCoords } from '/@/lib/land';
import { clearLandScene } from '/@/lib/landUnpublish';
import type {
  WorldScene,
  WorldSettings,
  WorldsWalletStats,
  WorldPermissionsResponse,
  WorldPermissions,
} from '/@/lib/worlds';
import { WorldRoleType, Worlds } from '/@/lib/worlds';
import { createAsyncThunk } from '/@/modules/store/thunk';
import type { AppState } from '/@/modules/store';
import { accountChanged, isSignedInAccount } from '/@/modules/store/account';
import {
  fetchContributableNames,
  fetchENSList,
  type ContributableNames,
} from '/@/modules/store/ens';
import { fetchLandList } from '/@/modules/store/land';
import type { AccountHoldings } from '/@/lib/account';
import { Account } from '/@/lib/account';
import {
  fetchWorldSceneList,
  getThumbnailUrlFromDeployment,
  getWorldPermissionsInitialState,
  getWorldSettingsInitialState,
  groupLandDeployments,
  selectLandProjects,
  selectWorldProjects,
  toLandProject,
  toManagedProject,
  toStreamOnlyProject,
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
  scenesStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

export type WorldPermissionsState = {
  worldName: string;
  owner: string;
  summary: WorldPermissionsResponse['summary'];
  permissions: WorldPermissions | null;
  parcels: Record<string, ParcelsPermission>;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

type LandProjectsState = {
  projects: ManagedProject[];
  deployments: Record<string, LandDeployment[]>;
  deployers: Record<string, string>;
  requestId: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

export type ManagementState = {
  tab: ManageTab;
  sortBy: SortBy;
  publishFilter: FilterBy | undefined;
  searchQuery: string;
  page: number;
  total: number;
  projects: ManagedProject[];
  emptyProjects: ManagedProject[];
  streamOnlyProjects: ManagedProject[];
  storageStats: WorldsWalletStats | null;
  accountHoldings: AccountHoldings | null;
  worldSettings: WorldSettingsState;
  worldPermissions: WorldPermissionsState;
  lands: LandProjectsState;
  /** The latest request id of each wallet-scoped thunk, keyed by its type prefix. */
  requestIds: Partial<Record<string, string>>;
};

export const initialState: Async<ManagementState> = {
  tab: 'worlds',
  sortBy: SortBy.LATEST,
  publishFilter: undefined,
  searchQuery: '',
  page: 0,
  total: 0,
  projects: [],
  emptyProjects: [],
  streamOnlyProjects: [],
  storageStats: null,
  accountHoldings: null,
  status: 'idle',
  error: null,
  worldSettings: getWorldSettingsInitialState(),
  worldPermissions: getWorldPermissionsInitialState(),
  lands: {
    projects: [],
    deployments: {},
    deployers: {},
    requestId: null,
    status: 'idle',
    error: null,
  },
  requestIds: {},
};

const PROJECTS_PAGE_LIMIT = 50;

/** Scene lookups fan out one request per world, so they run a few at a time. */
const limit = pLimit(6);

/** Gets all user ENS, LANDs, storage stats and filtered managed projects */
export const fetchAllManagedProjectsData = createAsyncThunk(
  'management/fetchAllManagedProjectsData',
  async ({ address }: { address: string }, { dispatch }) => {
    await Promise.all([
      dispatch(fetchENSList({ address })).unwrap(),
      dispatch(fetchLandList({ address })).unwrap(),
    ]);

    const [projects] = await Promise.all([
      dispatch(fetchManagedProjectsFiltered()).unwrap(),
      dispatch(fetchStorageStats({ address })).unwrap(),
      dispatch(fetchAccountHoldings({ address })).unwrap(),
    ]);

    return projects;
  },
  { condition: isSignedInAccount },
);

/** Fetches managed projects according to current filters in the state */
export const fetchManagedProjectsFiltered = createAsyncThunk(
  'management/fetchManagedProjectsWithFilters',
  async (args: { resetPage?: boolean } | undefined, { dispatch, getState }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    if (args?.resetPage) dispatch(actions.setPage(0));
    const { publishFilter, page } = getState().management;
    if (publishFilter !== FilterBy.UNPUBLISHED) {
      await dispatch(fetchWorlds({ address: connectedAccount })).unwrap();
    }
    if (page === 0) {
      const address = connectedAccount;
      const contributable = await dispatch(fetchContributableNames({ address })).unwrap();
      if (publishFilter !== FilterBy.PUBLISHED) {
        await dispatch(fetchEmptyWorlds({ address, contributable })).unwrap();
      }
      await dispatch(fetchStreamOnlyWorlds({ address, names: contributable.streamOnly })).unwrap();
    }
  },
);

/** Fetches published worlds (world settings configured) where the user is an owner or collaborator */
export const fetchWorlds = createAsyncThunk(
  'management/fetchWorlds',
  async ({ address }: { address: string }, { getState }) => {
    const { searchQuery, sortBy, page } = getState().management;
    const WorldsAPI = new Worlds();

    const worldsResponse = await WorldsAPI.fetchWorlds({
      has_deployed_scenes: true,
      limit: PROJECTS_PAGE_LIMIT,
      search: searchQuery,
      sort: sortBy,
      order: sortBy === SortBy.LATEST ? 'desc' : 'asc',
      authorized_deployer: address,
      offset: PROJECTS_PAGE_LIMIT * page,
    });
    if (worldsResponse === null) {
      throw new Error('Failed to fetch worlds');
    }

    const worldProjects: ManagedProject[] = await Promise.all(
      worldsResponse.worlds.map(world => limit(() => toManagedProject(WorldsAPI, world, address))),
    );

    return { worlds: worldProjects, total: worldsResponse.total };
  },
  { condition: isSignedInAccount },
);

/** Fetches unpublished worlds (0 published scenes) where the user is an owner or collaborator */
export const fetchEmptyWorlds = createAsyncThunk(
  'management/fetchEmptyWorlds',
  async (
    { address, contributable }: { address: string; contributable?: ContributableNames },
    { dispatch, getState },
  ) => {
    const ensList = await dispatch(fetchENSList({ address, contributable })).unwrap();

    const prevProjects = getState().management.projects;
    const worldsAPI = new Worlds();

    const projectsPromises: Promise<ManagedProject | null>[] = ensList.map(async ens => {
      const worldProject = prevProjects.find(project => project.id === ens.subdomain);
      let scenesCount = worldProject?.deployment ? worldProject.deployment.scenesCount : null;

      if (scenesCount === null) {
        try {
          const worldScenes = await worldsAPI.fetchWorldScenes(ens.subdomain, { limit: 1 });
          scenesCount = worldScenes ? worldScenes.total : 0;
        } catch {
          scenesCount = 0;
        }
      }

      if (scenesCount > 0) return null;

      return {
        id: ens.subdomain,
        displayName: ens.subdomain,
        role:
          ens.nftOwnerAddress && ens.nftOwnerAddress?.toLowerCase() === address?.toLowerCase()
            ? WorldRoleType.OWNER
            : WorldRoleType.COLLABORATOR,
        owner: ens.nftOwnerAddress || undefined,
        type: ManagedProjectType.WORLD,
        deployment: undefined,
      } as ManagedProject;
    });

    const emptyProjectsList = await Promise.all(projectsPromises);
    return emptyProjectsList.filter(project => project !== null);
  },
  { condition: isSignedInAccount },
);

/** Fetches the Worlds the account can stream to but not publish to, as unlinked collaborator cards */
export const fetchStreamOnlyWorlds = createAsyncThunk(
  'management/fetchStreamOnlyWorlds',
  async ({ names }: { address: string; names: string[] }) => {
    const worldsAPI = new Worlds();
    return Promise.all(names.map(name => limit(() => toStreamOnlyProject(worldsAPI, name))));
  },
  { condition: isSignedInAccount },
);

export const fetchStorageStats = createAsyncThunk(
  'management/fetchStorageStats',
  async ({ address }: { address: string }) => {
    const WorldsAPI = new Worlds();
    const stats = await WorldsAPI.fetchWalletStats(address);
    return stats;
  },
  { condition: isSignedInAccount },
);

export const fetchAccountHoldings = createAsyncThunk(
  'management/fetchAccountHoldings',
  async ({ address }: { address: string }) => {
    const AccountAPI = new Account();
    const holdings = await AccountAPI.fetchAccountHoldings(address);
    return holdings;
  },
  { condition: isSignedInAccount },
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
    const refresh = await dispatch(fetchWorldSettings({ worldName }));
    void dispatch(fetchManagedProjectsFiltered({ resetPage: true }));
    return {
      worldName,
      worldSettings: refresh.payload ? null : worldSettings,
    };
  },
);

export const fetchWorldScenes = createAsyncThunk(
  'management/fetchWorldScenes',
  async ({ worldName }: { worldName: string }) => {
    const WorldsAPI = new Worlds();
    const scenes = await fetchWorldSceneList(WorldsAPI, worldName);
    // A world with nothing deployed still answers with an empty list, so null is a failed
    // request. Reading it as "no scenes" would offer a single-scene publish over existing ones.
    if (!scenes) throw new Error(`Failed to fetch scenes for world "${worldName}"`);
    return scenes.map(scene => ({
      ...scene,
      thumbnailUrl: getThumbnailUrlFromDeployment(scene.entity, $ => WorldsAPI.getContentSrcUrl($)),
    }));
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
      // The unpublish already happened; a failed refresh reports itself and must not undo that.
      await dispatch(fetchWorldScenes({ worldName }));
      dispatch(fetchManagedProjectsFiltered({ resetPage: true }));
    } else {
      throw new Error('Failed to unpublish world scene');
    }
  },
);

export const unpublishEntireWorld = createAsyncThunk(
  'management/unpublishEntireWorld',
  async ({ worldName }: { worldName: string }, { dispatch }) => {
    const connectedAccount = AuthServerProvider.getAccount();
    if (!connectedAccount) throw new Error('No connected account found');

    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.unpublishEntireWorld(connectedAccount, worldName);
    if (success) {
      // The unpublish already happened; a failed refresh reports itself and must not undo that.
      await dispatch(fetchWorldScenes({ worldName }));
      dispatch(fetchManagedProjectsFiltered({ resetPage: true }));
    } else {
      throw new Error('Failed to unpublish world');
    }
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
    { worldName, worldPermissionName, worldPermissionType, options }: WorldPermissionsPayload,
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
      options,
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

    const firstPage = await WorldsAPI.fetchParcelsPermission(
      worldName,
      permissionName,
      walletAddress,
      { limit: LIMIT, offset: 0 },
    );

    // A null first page means the request failed, not that the user has zero parcels.
    // Fulfilling here would be indistinguishable from world-wide permission (empty parcels array).
    if (!firstPage) {
      throw new Error(`Failed to fetch parcels permission for world "${worldName}"`);
    }

    if (firstPage.total <= LIMIT) {
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
    if (pages.some(page => !page)) {
      throw new Error(`Failed to fetch every parcels permission page for world "${worldName}"`);
    }
    const allParcels = [...firstPage.parcels, ...pages.flatMap(page => page!.parcels)];

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

/** Fetches the account's LANDs as managed projects, one per parcel or estate, with their deployments */
export const fetchLandProjects = createAsyncThunk(
  'management/fetchLandProjects',
  async (_: void, { dispatch }) => {
    const address = AuthServerProvider.getAccount();
    if (!address) throw new Error('No connected account found');

    const { land } = await dispatch(fetchLandList({ address })).unwrap();
    const LandsAPI = new Lands();
    const deployments = groupLandDeployments(
      land,
      await LandsAPI.fetchLandPublishedScenes(ownedCoords(land)),
    );

    return {
      projects: land.map(item =>
        toLandProject(item, deployments[item.id] ?? [], hash => LandsAPI.getContentSrcUrl(hash)),
      ),
      deployments,
    };
  },
);

/** Fetches who deployed each of the given scene entities, skipping the ones already known. */
export const fetchLandDeployers = createAsyncThunk(
  'management/fetchLandDeployers',
  async (entityIds: string[], { getState }) => {
    const known = getState().management.lands.deployers;
    const unknown = entityIds.filter(id => !(id in known));
    return unknown.length ? new Lands().fetchDeployers(unknown) : {};
  },
);

/** Unpublishes a LAND scene by deploying an empty scene over it, then refetches the LAND projects */
export const unpublishLandScene = createAsyncThunk(
  'management/unpublishLandScene',
  async ({ scene }: { scene: { base: string; parcels: string[] } }, { dispatch, getState }) => {
    const address = AuthServerProvider.getAccount();
    if (!address) throw new Error('No connected account found');

    await clearLandScene(scene, getState().land.data, address);
    await dispatch(fetchLandProjects()).unwrap();
  },
);

const walletRequests = [
  fetchAllManagedProjectsData,
  fetchManagedProjectsFiltered,
  fetchWorlds,
  fetchEmptyWorlds,
  fetchStreamOnlyWorlds,
  fetchStorageStats,
  fetchAccountHoldings,
] as const;

type RequestAction = { type: string; meta: { requestId: string } };

const requestKey = ({ type }: RequestAction) => type.slice(0, type.lastIndexOf('/'));

const isLatestRequest = (state: Pick<ManagementState, 'requestIds'>, action: RequestAction) =>
  state.requestIds[requestKey(action)] === action.meta.requestId;

const slice = createSlice({
  name: 'management',
  initialState,
  reducers: {
    setSortBy: (state, action: PayloadAction<SortBy>) => {
      state.sortBy = action.payload;
      state.page = 0;
    },
    setTab: (state, action: PayloadAction<ManageTab>) => {
      state.tab = action.payload;
    },
    setPublishFilter: (state, action: PayloadAction<FilterBy | undefined>) => {
      state.publishFilter = action.payload;
      state.page = 0;
      state.total = 0;
      state.projects = [];
      state.emptyProjects = [];
      state.streamOnlyProjects = [];
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
      .addCase(accountChanged, () => initialState)
      .addCase(fetchAllManagedProjectsData.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsData.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsData.rejected, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch managed projects';
      })
      .addCase(fetchManagedProjectsFiltered.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchManagedProjectsFiltered.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchManagedProjectsFiltered.rejected, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch managed projects filtered';
      })
      .addCase(fetchWorlds.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.projects =
          state.page === 0
            ? (action.payload.worlds ?? [])
            : [...state.projects, ...(action.payload.worlds ?? [])];
        state.total = action.payload.total;
      })
      .addCase(fetchEmptyWorlds.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.emptyProjects = action.payload ?? [];
      })
      .addCase(fetchStreamOnlyWorlds.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.streamOnlyProjects = action.payload;
      })
      .addCase(fetchStorageStats.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.storageStats = action.payload;
      })
      .addCase(fetchAccountHoldings.fulfilled, (state, action) => {
        if (!isLatestRequest(state, action)) return;
        state.accountHoldings = action.payload;
      })
      .addCase(fetchWorldScenes.pending, (state, action) => {
        switchWorldSettings(state.worldSettings, action.meta.arg.worldName);
        state.worldSettings.scenesStatus = 'loading';
      })
      .addCase(fetchWorldScenes.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.scenes = action.payload ?? [];
        state.worldSettings.scenesStatus = 'succeeded';
      })
      .addCase(fetchWorldScenes.rejected, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.scenesStatus = 'failed';
      })
      .addCase(fetchWorldSettings.pending, (state, action) => {
        switchWorldSettings(state.worldSettings, action.meta.arg.worldName);
        state.worldSettings.status = 'loading';
        state.worldSettings.error = null;
      })
      .addCase(fetchWorldSettings.fulfilled, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.settings = action.payload ?? state.worldSettings.settings;
        state.worldSettings.status = 'succeeded';
        state.worldSettings.error = null;
      })
      .addCase(updateWorldSettings.fulfilled, (state, action) => {
        if (action.payload.worldName !== state.worldSettings.worldName) return;
        if (action.payload.worldSettings)
          Object.assign(state.worldSettings.settings, action.payload.worldSettings);
        state.worldSettings.status = 'succeeded';
        state.worldSettings.error = null;
      })
      .addCase(fetchWorldSettings.rejected, (state, action) => {
        if (action.meta.arg.worldName !== state.worldSettings.worldName) return;
        state.worldSettings.status = Object.keys(state.worldSettings.settings).length
          ? 'succeeded'
          : 'failed';
        state.worldSettings.error = action.error.message || 'Failed to fetch world settings';
      })
      .addCase(fetchWorldPermissions.pending, (state, action) => {
        const prevWorldName = state.worldPermissions.worldName;
        const newWorldName = action.meta.arg.worldName;
        if (prevWorldName && newWorldName !== prevWorldName) {
          state.worldPermissions = getWorldPermissionsInitialState();
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
      .addCase(fetchParcelsPermission.pending, (state, action) => {
        const { walletAddress, worldName } = action.meta.arg;
        // Parcels are stored per wallet, not per world: carrying another world's list over
        // would show its parcels as deployable here until this fetch settles.
        const sameWorld = state.worldPermissions.worldName === worldName;
        state.worldPermissions.worldName = worldName;
        state.worldPermissions.parcels[walletAddress] = {
          parcels: sameWorld ? state.worldPermissions.parcels[walletAddress]?.parcels || [] : [],
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
        state.worldPermissions.parcels[walletAddress] = { parcels: [], status: 'failed' };
      })
      .addCase(fetchLandDeployers.fulfilled, (state, action) => {
        Object.assign(state.lands.deployers, action.payload);
      })
      .addCase(fetchLandProjects.pending, (state, action) => {
        state.lands.requestId = action.meta.requestId;
        state.lands.status = 'loading';
        state.lands.error = null;
      })
      .addCase(fetchLandProjects.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.lands.requestId) return;
        state.lands.projects = action.payload.projects;
        state.lands.deployments = action.payload.deployments;
        state.lands.status = 'succeeded';
      })
      .addCase(fetchLandProjects.rejected, (state, action) => {
        if (action.meta.requestId !== state.lands.requestId) return;
        state.lands.status = 'failed';
        state.lands.error = action.error.message || 'Failed to fetch LAND projects';
      })
      .addMatcher(isPending(...walletRequests), (state, action) => {
        state.requestIds[requestKey(action)] = action.meta.requestId;
      });
  },
});

// Settings and scenes load separately, and whichever request starts first claims the new
// world, so each must drop the previous world's data or it shows under the new name. The
// settings read as loading until their own request lands for the new world.
function switchWorldSettings(worldSettings: WorldSettingsState, worldName: string) {
  if (worldSettings.worldName === worldName) return;
  worldSettings.worldName = worldName;
  worldSettings.settings = {};
  worldSettings.scenes = [];
  worldSettings.status = 'loading';
}

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

const getWorldProjects = createSelector(
  [
    (state: AppState) => state.management.projects,
    (state: AppState) => state.management.emptyProjects,
    (state: AppState) => state.management.streamOnlyProjects,
    (state: AppState) => state.management.sortBy,
    (state: AppState) => state.management.searchQuery,
    (state: AppState) => state.management.publishFilter,
  ],
  (published, empty, streamOnly, sortBy, searchQuery, publishFilter) =>
    selectWorldProjects(published, empty, { sortBy, searchQuery, publishFilter }, streamOnly),
);

const getLandProjects = createSelector(
  [
    (state: AppState) => state.management.lands.projects,
    (state: AppState) => state.land.data,
    (state: AppState) => state.management.publishFilter,
    (state: AppState) => state.management.sortBy,
    (state: AppState) => state.management.searchQuery,
  ],
  (projects, lands, publishFilter, sortBy, searchQuery) =>
    selectLandProjects(projects, lands, { publishFilter, sortBy, searchQuery }),
);

const getError = createSelector(getManagementState, managementState => managementState.error);

const getPermissionsState = (state: AppState) => state.management.worldPermissions;

const getParcelsStateForAddress = (
  state: AppState,
  walletAddress: string,
): ParcelsPermission | undefined => {
  return state.management.worldPermissions.parcels[walletAddress];
};

export const actions = {
  ...slice.actions,
  fetchAllManagedProjectsData,
  fetchManagedProjectsFiltered,
  fetchWorlds,
  fetchEmptyWorlds,
  fetchStreamOnlyWorlds,
  fetchWorldSettings,
  updateWorldSettings,
  fetchStorageStats,
  fetchAccountHoldings,
  fetchWorldScenes,
  unpublishWorldScene,
  unpublishEntireWorld,
  fetchWorldPermissions,
  updateWorldPermissions,
  addAddressPermission,
  removeAddressPermission,
  fetchParcelsPermission,
  addParcelsPermission,
  removeParcelsPermission,
  fetchLandDeployers,
  fetchLandProjects,
  unpublishLandScene,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getManagedProjects,
  getWorldProjects,
  getWorldSettings,
  getWorldScenes,
  getLandProjects,
  getError,
  getPermissionsState,
  getParcelsStateForAddress,
};
