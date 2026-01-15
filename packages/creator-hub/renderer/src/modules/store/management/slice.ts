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
import type { Metadata, WorldsWalletStats } from '/@/lib/worlds';
import { Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList } from '/@/modules/store/land';
import { tryCatch } from '/shared/try-catch';
import { coordsToId, LandType } from '/@/lib/land';
import type { AccountHoldings } from '/@/lib/account';
import { Account } from '/@/lib/account';

// state
export type ManagementState = {
  sortBy: SortBy;
  searchQuery: string;
  projects: ManagedProject[];
  storageStats: WorldsWalletStats | null;
  accountHoldings: AccountHoldings | null;
};

export const initialState: Async<ManagementState> = {
  sortBy: SortBy.LATEST,
  searchQuery: '',
  projects: [],
  storageStats: null,
  accountHoldings: null,
  status: 'idle',
  error: null,
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

    await Promise.all([
      dispatch(fetchAllManagedProjectsDetails({ address })).unwrap(),
      dispatch(fetchStorageStats({ address })).unwrap(),
      dispatch(fetchAccountHoldings({ address })).unwrap(),
    ]);
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

      const managedProjects: ManagedProject[] = [];

      const WorldsAPI = new Worlds();

      // Fetch deployment details for worlds that have entityId
      await Promise.all(
        ensList.map(async ens => {
          let totalScenes = 0;
          let publishedAt = 0;
          let thumbnail = '';
          let metadata: Metadata | null = null;

          try {
            const worldScenes = await WorldsAPI.fetchWorldScenes(ens.subdomain);
            totalScenes = worldScenes?.total || 0;
          } catch (error) {
            // Ignore errors for individual worlds
          }

          try {
            const world = await WorldsAPI.fetchWorld(ens.subdomain);
            if (world && world.length > 0) {
              publishedAt = world[0].timestamp;
              metadata = world[0].metadata || null;
              if (metadata?.display.navmapThumbnail) {
                const thumbnailContent = world[0].content.find(
                  item => item.file === metadata?.display.navmapThumbnail,
                );
                if (thumbnailContent) {
                  thumbnail = `https://peer.decentraland.org/content/${thumbnailContent.hash}`; /// TODO: find the url for it.
                }
              }
            }
          } catch (error) {
            // Ignore errors for individual worlds
          }

          managedProjects.push({
            id: ens.subdomain,
            type: ManagedProjectType.WORLD,
            role:
              ens.nftOwnerAddress.toLowerCase() === address.toLowerCase() ? 'owner' : 'operator',
            title: metadata?.display?.title || '',
            thumbnail,
            totalParcels: metadata?.scene.parcels?.length,
            totalScenes,
            publishedAt,
          });
        }),
      );

      // Process Land data

      // Extract coordinates for all lands
      const coordinates: string[] = [];
      const coordToLandMap = new Map<string, (typeof landList)[0]>();

      landList.forEach(land => {
        if (land.type === LandType.PARCEL && land.x !== undefined && land.y !== undefined) {
          const coord = coordsToId(land.x, land.y);
          coordinates.push(coord);
          coordToLandMap.set(coord, land);
        } else if (land.type === LandType.ESTATE && land.parcels && land.parcels.length > 0) {
          // For estates, check first parcel (scenes span all parcels)
          const firstParcel = land.parcels[0];
          const coord = coordsToId(firstParcel.x, firstParcel.y);
          coordinates.push(coord);
          coordToLandMap.set(coord, land);
        }

        managedProjects.push({
          id: land.id,
          type: ManagedProjectType.LAND,
          role: land.owner.toLowerCase() === address.toLowerCase() ? 'owner' : 'operator',
          title: '',
          thumbnail: '',
          totalParcels: land.type === LandType.PARCEL ? 1 : land.size,
          totalScenes: 1, // 1 if scene deployed, 0 otherwise --- TODO: fetch real scene count
          publishedAt: 0,
          /// TODO: fill these missing fields.
        });
      });

      return managedProjects;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch managed items',
        code: error.code,
      });
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
      .addCase(fetchManagedProjects.fulfilled, state => {
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
      });
  },
});

// selectors
const getManagementState = (state: AppState) => state.management;
const getManagedProjects = createSelector(
  getManagementState,
  managementState => managementState.projects,
);

const getError = createSelector(getManagementState, managementState => managementState.error);

// exports
export const actions = {
  ...slice.actions,
  fetchAllManagedProjectsDetails,
  fetchManagedProjects,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getManagedProjects,
  getError,
};
