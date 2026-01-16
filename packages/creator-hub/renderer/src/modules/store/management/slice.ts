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
import type { WorldDeployment } from '/@/lib/worlds';
import { Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList } from '/@/modules/store/land';
import { tryCatch } from '/shared/try-catch';
import type { LandDeployment } from '/@/lib/land';
import { Lands, LandType } from '/@/lib/land';

// state
export type ManagementState = {
  sortBy: SortBy;
  searchQuery: string;
  projects: ManagedProject[]; // List of managed projects
};

export const initialState: Async<ManagementState> = {
  sortBy: SortBy.LATEST,
  searchQuery: '',
  projects: [],
  status: 'idle',
  error: null,
};

// thunks
export const fetchManagedProjects = createAsyncThunk(
  'management/fetchManagedProjects',
  async ({ address, chainId }: { address: string; chainId: ChainId }, { dispatch }) => {
    await Promise.all([
      tryCatch(dispatch(fetchENSList({ address, chainId })).unwrap()),
      tryCatch(dispatch(fetchLandList({ address })).unwrap()),
    ]);

    await dispatch(fetchAllManagedProjectsDetails({ address })).unwrap();
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

      const getWorldThumbnailUrl = (deployment: WorldDeployment) => {
        if (!deployment?.metadata.display.navmapThumbnail) return '';
        const thumbnailFileName = deployment.metadata.display.navmapThumbnail;
        const thumbnailContent = deployment.content.find(item => item.file === thumbnailFileName);
        if (thumbnailContent) return WorldsAPI.getContentSrcUrl(thumbnailContent.hash);
        return '';
      };

      // Fetch deployment details for worlds that have entityId
      await Promise.all(
        ensList.map(async ens => {
          const worldDeployment = await WorldsAPI.fetchWorld(ens.subdomain);
          const worldScenes = await WorldsAPI.fetchWorldScenes(ens.subdomain);

          managedProjects.push({
            id: ens.subdomain,
            displayName: ens.subdomain,
            type: ManagedProjectType.WORLD,
            role:
              ens.nftOwnerAddress.toLowerCase() === address.toLowerCase() ? 'owner' : 'operator',
            deployment:
              worldDeployment && worldDeployment[0]
                ? {
                    title: worldDeployment[0].metadata.display.title,
                    description: worldDeployment[0].metadata.display.description,
                    thumbnail: getWorldThumbnailUrl(worldDeployment[0]),
                    lastPublishedAt:
                      worldScenes?.scenes?.reduce(
                        (max, scene) => Math.max(max, scene.createdAt.getTime()),
                        0,
                      ) ?? 0, // Get latest published scene date.
                    scenes:
                      worldScenes?.scenes?.map(scene => ({
                        id: scene.id,
                        publishedAt: scene.createdAt.getTime() ?? 0,
                        parcels: scene.parcels,
                      })) ?? [],
                  }
                : undefined,
          });
        }),
      );

      const LandsAPI = new Lands();

      const getLandThumbnailUrl = (deployment: LandDeployment) => {
        if (!deployment?.metadata.display.navmapThumbnail) return '';
        const thumbnailFileName = deployment.metadata.display.navmapThumbnail;
        const thumbnailContent = deployment.content.find(item => item.file === thumbnailFileName);
        if (thumbnailContent) return LandsAPI.getContentSrcUrl(thumbnailContent.hash);
        return '';
      };

      // Process Land data
      await Promise.all(
        landList.map(async land => {
          let sceneDeployment: LandDeployment | null = null;
          const landCoords =
            land.type === LandType.PARCEL ? { x: land.x, y: land.y } : land.parcels?.[0];
          if (landCoords?.x && landCoords?.y) {
            sceneDeployment = await LandsAPI.fetchLandPublishedScene(landCoords.x, landCoords.y);
          }

          managedProjects.push({
            id: land.id,
            displayName: land.type === LandType.ESTATE ? land.name : land.id,
            type: ManagedProjectType.LAND,
            role: land.owner.toLowerCase() === address.toLowerCase() ? 'owner' : 'operator',
            deployment: sceneDeployment
              ? {
                  title: sceneDeployment.metadata?.display?.title || '',
                  description: sceneDeployment.metadata?.display?.description || '',
                  thumbnail: getLandThumbnailUrl(sceneDeployment),
                  lastPublishedAt: sceneDeployment.timestamp,
                  scenes: [
                    {
                      id: sceneDeployment.id,
                      publishedAt: sceneDeployment.timestamp,
                      parcels: sceneDeployment.metadata?.scene.parcels || [],
                    },
                  ],
                }
              : undefined,
          });
        }),
      );

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
      .addCase(fetchAllManagedProjectsDetails.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsDetails.fulfilled, (state, action) => {
        state.projects = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchAllManagedProjectsDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as Error)?.message || 'Failed to fetch managed projects';
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
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getManagedProjects,
  getError,
  getWorldItems,
  getLandItems,
};
