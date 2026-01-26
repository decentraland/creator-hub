import {
  createAsyncThunk,
  createSlice,
  createSelector,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { ChainId } from '@dcl/schemas';
import type { Async } from '/shared/types/async';
import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType, SortBy } from '/shared/types/manage';
import type { WorldScene, WorldSettings, WorldsWalletStats } from '/@/lib/worlds';
import { WorldRoleType, Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList } from '/@/modules/store/land';
import { tryCatch } from '/shared/try-catch';
import type { LandDeployment } from '/@/lib/land';
import { Lands, LandType } from '/@/lib/land';
import type { AccountHoldings } from '/@/lib/account';
import { Account } from '/@/lib/account';
import { getThumbnailUrlFromDeployment } from './utils';

// state
export type ManagementState = {
  sortBy: SortBy;
  searchQuery: string;
  projects: ManagedProject[];
  storageStats: WorldsWalletStats | null;
  accountHoldings: AccountHoldings | null;
  worldSettings: {
    worldName: string;
    settings: WorldSettings;
    scenes: WorldScene[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
};

export const initialState: Async<ManagementState> = {
  sortBy: SortBy.LATEST,
  searchQuery: '',
  projects: [],
  storageStats: null,
  accountHoldings: null,
  status: 'idle',
  error: null,
  worldSettings: {
    worldName: '',
    settings: {},
    scenes: [],
    status: 'idle',
    error: null,
  },
};

// thunks
export const fetchManagedProjects = createAsyncThunk(
  'management/fetchManagedProjects',
  async ({ address, chainId }: { address: string; chainId: ChainId }, { dispatch }) => {
    // Fetch NAMEs and Land parcels/estates in parallel. Wrapped in tryCatch to avoid failing the whole thunk if one fails.
    await Promise.all([
      tryCatch(dispatch(fetchENSList({ address, chainId })).unwrap()),
      tryCatch(dispatch(fetchLandList({ address })).unwrap()),
    ]);

    const [projects] = await Promise.all([
      dispatch(fetchAllManagedProjectsDetails({ address })).unwrap(),
      dispatch(fetchStorageStats({ address })).unwrap(),
      dispatch(fetchAccountHoldings({ address })).unwrap(),
    ]);

    return projects;
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

export const fetchAllManagedProjectsDetails = createAsyncThunk(
  'management/fetchAllManagedProjectsDetails',
  async ({ address }: { address: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as AppState;

      // Read ENS and Land data from state
      const ensList = Object.values(state.ens.data);
      const landList = state.land.data;

      const WorldsAPI = new Worlds();
      const LandsAPI = new Lands();

      // Process Worlds data
      const worldsPromises: Promise<ManagedProject>[] = ensList.map(async ens => {
        const [worldDeployment, worldScenes] = await Promise.all([
          WorldsAPI.fetchWorld(ens.subdomain),
          WorldsAPI.fetchWorldScenes(ens.subdomain),
        ]);

        return {
          id: ens.subdomain,
          displayName: ens.subdomain,
          type: ManagedProjectType.WORLD,
          role:
            ens.nftOwnerAddress.toLowerCase() === address.toLowerCase()
              ? WorldRoleType.OWNER
              : WorldRoleType.COLLABORATOR,
          deployment:
            worldDeployment && worldDeployment[0]
              ? {
                  title: worldDeployment[0].metadata.display.title,
                  description: worldDeployment[0].metadata.display.description,
                  thumbnail: getThumbnailUrlFromDeployment(worldDeployment[0], $ =>
                    WorldsAPI.getContentSrcUrl($),
                  ),
                  lastPublishedAt:
                    worldScenes?.scenes?.reduce(
                      (max, scene) => Math.max(max, new Date(scene.createdAt).getTime() ?? 0),
                      0,
                    ) ??
                    worldDeployment[0].timestamp ??
                    0, // Get latest published scene date.
                  scenes:
                    worldScenes?.scenes?.map(scene => ({
                      id: scene.entityId,
                      publishedAt: new Date(scene.createdAt).getTime() ?? 0,
                      parcels: scene.parcels,
                    })) ?? [],
                }
              : undefined,
        };
      });

      // Process Lands data
      const landsPromises: Promise<ManagedProject>[] = landList.map(async land => {
        let sceneDeployment: LandDeployment | null = null;
        const landCoords =
          land.type === LandType.PARCEL ? { x: land.x, y: land.y } : land.parcels?.[0];
        if (landCoords?.x && landCoords?.y) {
          sceneDeployment = await LandsAPI.fetchLandPublishedScene(landCoords.x, landCoords.y);
        }

        return {
          id: land.id,
          displayName: land.type === LandType.ESTATE ? land.name : land.id,
          type: ManagedProjectType.LAND,
          role: land.role,
          deployment: sceneDeployment
            ? {
                title: sceneDeployment.metadata?.display?.title || '',
                description: sceneDeployment.metadata?.display?.description || '',
                thumbnail: getThumbnailUrlFromDeployment(sceneDeployment, $ =>
                  LandsAPI.getContentSrcUrl($),
                ),
                lastPublishedAt: sceneDeployment.timestamp ?? 0,
                scenes: [
                  {
                    id: sceneDeployment.id,
                    publishedAt: sceneDeployment.timestamp,
                    parcels: sceneDeployment.metadata?.scene.parcels || [],
                  },
                ],
              }
            : undefined,
        };
      });

      const managedProjects = await Promise.all([...worldsPromises, ...landsPromises]);
      return managedProjects;
    } catch (error) {
      return rejectWithValue({
        message: (error as Error).message || 'Failed to fetch managed items',
      });
    }
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

export const unpublishWorldScene = createAsyncThunk(
  'management/unpublishWorldScene',
  async ({
    address,
    worldName,
    sceneCoords,
  }: {
    address: string;
    worldName: string;
    sceneCoords: string;
  }) => {
    const WorldsAPI = new Worlds();
    const success = await WorldsAPI.unpublishWorldScene(address, worldName, sceneCoords);
    return success;
  },
);

// slice
const slice = createSlice({
  name: 'management',
  initialState,
  reducers: {
    setSortBy: (state, action: PayloadAction<SortBy>) => {
      state.sortBy = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchManagedProjects.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchManagedProjects.fulfilled, (state, action) => {
        state.projects = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchManagedProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as Error)?.message || 'Failed to fetch managed projects';
      })
      .addCase(fetchAllManagedProjectsDetails.fulfilled, (state, action) => {
        state.projects = action.payload;
      })
      .addCase(fetchStorageStats.fulfilled, (state, action) => {
        state.storageStats = action.payload;
      })
      .addCase(fetchAccountHoldings.fulfilled, (state, action) => {
        state.accountHoldings = action.payload;
      })
      .addCase(fetchWorldScenes.fulfilled, (state, action) => {
        state.worldSettings.scenes = action.payload;
      })
      .addCase(fetchWorldSettings.pending, (state, action) => {
        state.worldSettings.worldName = action.meta.arg.worldName;
        state.worldSettings.settings = {} as WorldSettings;
        state.worldSettings.status = 'loading';
        state.worldSettings.error = null;
      })
      .addCase(fetchWorldSettings.fulfilled, (state, action) => {
        state.worldSettings.settings = action.payload;
        state.worldSettings.status = 'succeeded';
        state.worldSettings.error = null;
      })
      .addCase(fetchWorldSettings.rejected, (state, action) => {
        state.worldSettings.status = 'failed';
        state.worldSettings.error = action.error.message || 'Failed to fetch world settings';
      });
  },
});

// selectors
const getManagedProjects = (state: Async<ManagementState>) => state.projects;
const getError = (state: Async<ManagementState>) => state.error;

const getWorldItems = createSelector([getManagedProjects], items =>
  items.filter(item => item.type === ManagedProjectType.WORLD),
);

const getLandItems = createSelector([getManagedProjects], items =>
  items.filter(item => item.type === ManagedProjectType.LAND),
);

// exports
export const actions = {
  ...slice.actions,
  fetchAllManagedProjectsDetails,
  fetchManagedProjects,
  fetchWorldSettings,
  fetchStorageStats,
  fetchAccountHoldings,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getManagedProjects,
  getError,
  getWorldItems,
  getLandItems,
};
