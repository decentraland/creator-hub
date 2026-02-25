import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthServerProvider } from 'decentraland-connect';
import type { ManagedProject } from '../../../../../shared/types/manage';
import { SortBy, FilterBy, ManagedProjectType } from '../../../../../shared/types/manage';
import { createTestStore } from '../../../../tests/utils/testStore';
import {
  actions,
  initialState,
  selectors,
  fetchManagedProjectsFiltered,
  fetchStorageStats,
  fetchAccountHoldings,
  fetchWorldSettings,
  fetchWorldScenes,
  fetchWorldPermissions,
  addAddressPermission,
  fetchParcelsPermission,
  unpublishWorldScene,
  unpublishEntireWorld,
  updateWorldPermissions,
  removeAddressPermission,
  addParcelsPermission,
  removeParcelsPermission,
  fetchWorlds,
  fetchEmptyWorlds,
  updateWorldSettings,
} from './slice';

const TEST_ADDRESS = '0x123abc';
const TEST_WORLD_NAME = 'test-world';
const TEST_WALLET_ADDRESS = '0x456def';

type WorldPermissionsResponse = any;
type WorldSettings = any;
type WorldsWalletStats = any;
type AccountHoldings = any;

const WorldPermissionType = {
  Unrestricted: 'unrestricted',
  AllowList: 'allowlist',
  NFTOwnership: 'nftownership',
} as const;

const createMockWorldsAPI = () => ({
  fetchWorlds: vi.fn(),
  fetchEmptyWorlds: vi.fn(),
  fetchWorldScenes: vi.fn(),
  fetchWorldSettings: vi.fn(),
  fetchWalletStats: vi.fn(),
  getContentSrcUrl: vi.fn((hash: string) => `https://content.com/${hash}`),
  unpublishWorldScene: vi.fn(),
  unpublishEntireWorld: vi.fn(),
  putWorldSettings: vi.fn(),
  getPermissions: vi.fn(),
  postPermissionType: vi.fn(),
  putPermissionType: vi.fn(),
  deletePermissionType: vi.fn(),
  fetchParcelsPermission: vi.fn(),
  postParcelsPermission: vi.fn(),
  deleteParcelsPermission: vi.fn(),
});

const createMockLandsAPI = () => ({
  fetchLandPublishedScene: vi.fn(),
  getContentSrcUrl: vi.fn((hash: string) => `https://land-content.com/${hash}`),
});

const createMockAccountAPI = () => ({
  fetchAccountHoldings: vi.fn(),
});

let mockWorldsAPI: ReturnType<typeof createMockWorldsAPI>;
let mockLandsAPI: ReturnType<typeof createMockLandsAPI>;
let mockAccountAPI: ReturnType<typeof createMockAccountAPI>;

vi.mock('/@/lib/worlds', () => ({
  Worlds: class {
    constructor() {
      return mockWorldsAPI;
    }
  },
  WorldRoleType: {
    OWNER: 'owner',
    COLLABORATOR: 'collaborator',
  },
  WorldPermissionType: {
    Unrestricted: 'unrestricted',
    AllowList: 'allowlist',
    NFTOwnership: 'nftownership',
  },
}));

vi.mock('/@/lib/land', () => ({
  Lands: class {
    constructor() {
      return mockLandsAPI;
    }
  },
  LandType: {
    PARCEL: 'parcel',
    ESTATE: 'estate',
  },
}));

vi.mock('/@/lib/account', () => ({
  Account: class {
    constructor() {
      return mockAccountAPI;
    }
  },
}));

vi.mock('/@/modules/store/ens', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchENSList: vi.fn().mockImplementation(({ address }) => {
      // Return a thunk that reads from the current store state
      return (_dispatch: any, getState: any) => {
        const ensState = getState().ens;
        const ensArray = Object.values(ensState.data || {});
        const result = {
          type: 'ens/fetchENSList/fulfilled',
          payload: ensArray,
          meta: { arg: { address } },
        };
        // Return promise-like object with unwrap method
        const promise: any = Promise.resolve(result);
        promise.unwrap = () => Promise.resolve(ensArray);
        return promise;
      };
    }),
  };
});

vi.mock('/@/modules/store/land', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchLandList: vi.fn().mockImplementation(({ address }) => ({
      type: 'land/fetchLandList/fulfilled',
      meta: { arg: { address } },
      unwrap: () => Promise.resolve([]),
    })),
  };
});

vi.mock('decentraland-connect', () => ({
  AuthServerProvider: {
    getAccount: vi.fn(),
  },
}));

vi.mock('./utils', () => ({
  getThumbnailUrlFromDeployment: vi.fn((deployment, getContentUrl) => {
    if (deployment?.metadata?.display?.favicon) {
      return getContentUrl(deployment.metadata.display.favicon);
    }
    return null;
  }),
  getWorldSettingsInitialState: vi.fn(() => ({
    worldName: '',
    settings: {},
    scenes: [],
    status: 'idle',
    error: null,
  })),
  getWorldPermissionsInitialState: vi.fn(() => ({
    worldName: '',
    owner: '',
    permissions: null,
    summary: {},
    parcels: {},
    loadingNewUser: false,
    status: 'idle',
    error: null,
  })),
}));

describe('management slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    mockWorldsAPI = createMockWorldsAPI();
    mockLandsAPI = createMockLandsAPI();
    mockAccountAPI = createMockAccountAPI();
    store = createTestStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(initialState.sortBy).toBe(SortBy.LATEST);
      expect(initialState.publishFilter).toBe(FilterBy.PUBLISHED);
      expect(initialState.searchQuery).toBe('');
      expect(initialState.page).toBe(0);
      expect(initialState.total).toBe(0);
      expect(initialState.projects).toEqual([]);
      expect(initialState.storageStats).toBeNull();
      expect(initialState.accountHoldings).toBeNull();
      expect(initialState.status).toBe('idle');
      expect(initialState.error).toBeNull();
    });

    it('should have correct worldSettings initial state', () => {
      expect(initialState.worldSettings).toEqual({
        worldName: '',
        settings: {},
        scenes: [],
        status: 'idle',
        error: null,
      });
    });

    it('should have correct worldPermissions initial state', () => {
      expect(initialState.worldPermissions).toEqual({
        worldName: '',
        owner: '',
        permissions: null,
        summary: {},
        parcels: {},
        loadingNewUser: false,
        status: 'idle',
        error: null,
      });
    });
  });

  describe('reducers', () => {
    it('should update sortBy state', () => {
      store.dispatch(actions.setSortBy(SortBy.LATEST));
      const state = store.getState().management;
      expect(state.sortBy).toBe(SortBy.LATEST);
    });

    it('should reset page to 0 when sortBy changes', () => {
      // First set page to something other than 0
      store.dispatch(actions.setPage(5));
      expect(store.getState().management.page).toBe(5);

      // Then change sortBy
      store.dispatch(actions.setSortBy(SortBy.LATEST));
      const state = store.getState().management;
      expect(state.page).toBe(0);
    });

    it('should update publishFilter state', () => {
      store.dispatch(actions.setPublishFilter(FilterBy.UNPUBLISHED));
      const state = store.getState().management;
      expect(state.publishFilter).toBe(FilterBy.UNPUBLISHED);
    });

    it('should reset page to 0 when publishFilter changes', () => {
      // First set page to something other than 0
      store.dispatch(actions.setPage(3));
      expect(store.getState().management.page).toBe(3);

      // Then change publishFilter
      store.dispatch(actions.setPublishFilter(FilterBy.UNPUBLISHED));
      const state = store.getState().management;
      expect(state.page).toBe(0);
    });

    it('should update searchQuery state', () => {
      const testQuery = 'test search';
      store.dispatch(actions.setSearchQuery(testQuery));
      const state = store.getState().management;
      expect(state.searchQuery).toBe(testQuery);
    });

    it('should reset page to 0 when searchQuery changes', () => {
      // First set page to something other than 0
      store.dispatch(actions.setPage(2));
      expect(store.getState().management.page).toBe(2);

      // Then change searchQuery
      store.dispatch(actions.setSearchQuery('test'));
      const state = store.getState().management;
      expect(state.page).toBe(0);
    });

    it('should update page state', () => {
      store.dispatch(actions.setPage(10));
      const state = store.getState().management;
      expect(state.page).toBe(10);
    });

    it('should clear error', () => {
      store.dispatch({
        type: 'management/fetchAllManagedProjectsData/rejected',
        error: { message: 'Test error' },
        meta: { arg: { address: TEST_ADDRESS } },
      });
      store.dispatch(actions.clearError());
      const state = store.getState().management;
      expect(state.error).toBeNull();
    });

    it('should reset worldPermissions to initial state', () => {
      store.dispatch({
        type: fetchWorldPermissions.fulfilled.type,
        payload: {
          permissions: { deployment: { type: WorldPermissionType.Unrestricted } },
          summary: {},
          owner: TEST_ADDRESS,
        },
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });
      store.dispatch(actions.clearPermissionsState());
      const state = store.getState().management;
      expect(state.worldPermissions).toEqual(initialState.worldPermissions);
    });
  });

  describe('fetchManagedProjectsFiltered', () => {
    it('should dispatch fetchWorlds when publishFilter is PUBLISHED', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockWorldsAPI.fetchWorlds.mockResolvedValue({ worlds: [], total: 0 });

      store.dispatch(actions.setPublishFilter(FilterBy.PUBLISHED));
      await store.dispatch(fetchManagedProjectsFiltered());

      expect(mockWorldsAPI.fetchWorlds).toHaveBeenCalled();
    });

    it('should throw error when no connected account is found', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(null);

      await expect(store.dispatch(fetchManagedProjectsFiltered()).unwrap()).rejects.toThrow(
        'No connected account found',
      );
    });
  });

  describe('fetchAllManagedProjectsData', () => {
    it('should set status to loading and clear error when pending', () => {
      store.dispatch({
        type: 'management/fetchAllManagedProjectsData/pending',
        meta: { arg: { address: TEST_ADDRESS } },
      });
      const state = store.getState().management;
      expect(state.status).toBe('loading');
      expect(state.error).toBeNull();
    });

    it('should set status to succeeded and clear error when fulfilled', () => {
      store.dispatch({
        type: 'management/fetchAllManagedProjectsData/fulfilled',
        payload: [],
        meta: { arg: { address: TEST_ADDRESS } },
      });
      const state = store.getState().management;
      expect(state.status).toBe('succeeded');
      expect(state.error).toBeNull();
    });

    it('should set status to failed and error message when rejected', () => {
      const errorMessage = 'Failed to fetch managed projects';
      store.dispatch({
        type: 'management/fetchAllManagedProjectsData/rejected',
        error: { message: errorMessage },
        meta: { arg: { address: TEST_ADDRESS } },
      });
      const state = store.getState().management;
      expect(state.status).toBe('failed');
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('fetchStorageStats', () => {
    it('should update storageStats in state', async () => {
      const mockStats = {
        usedSpace: 1000,
        maxAllowedSpace: 5000,
      } as WorldsWalletStats;

      mockWorldsAPI.fetchWalletStats.mockResolvedValue(mockStats);
      await store.dispatch(fetchStorageStats({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.storageStats).toEqual(mockStats);
    });
  });

  describe('fetchAccountHoldings', () => {
    it('should update accountHoldings in state', async () => {
      const mockHoldings = {
        mana: 1000,
        land: 5,
        names: 3,
      } as AccountHoldings;

      mockAccountAPI.fetchAccountHoldings.mockResolvedValue(mockHoldings);
      await store.dispatch(fetchAccountHoldings({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.accountHoldings).toEqual(mockHoldings);
    });
  });

  describe('fetchWorldSettings', () => {
    it('should update settings and set status to succeeded when fetching succeeds', async () => {
      const mockSettings = {
        name: TEST_WORLD_NAME,
        description: 'Test world description',
      } as WorldSettings;

      mockWorldsAPI.fetchWorldSettings.mockResolvedValue(mockSettings);
      await store.dispatch(fetchWorldSettings({ worldName: TEST_WORLD_NAME }));

      const state = store.getState().management;
      expect(state.worldSettings.settings).toEqual(mockSettings);
      expect(state.worldSettings.status).toBe('succeeded');
      expect(state.worldSettings.error).toBeNull();
    });

    it('should set status to failed and error message when fetching fails', async () => {
      const errorMessage = 'Settings fetch failed';
      mockWorldsAPI.fetchWorldSettings.mockRejectedValue(new Error(errorMessage));
      await store.dispatch(fetchWorldSettings({ worldName: TEST_WORLD_NAME })).catch(() => {});

      const state = store.getState().management;
      expect(state.worldSettings.status).toBe('failed');
      expect(state.worldSettings.error).toBe(errorMessage);
    });
  });

  describe('fetchWorldScenes', () => {
    it('should update scenes in state', async () => {
      const mockScenes = [
        {
          entityId: 'scene1',
          createdAt: '2024-01-01T00:00:00Z',
          parcels: ['0,0'],
          entity: {
            metadata: {
              display: {
                favicon: 'QmSceneFavicon',
              },
            },
          },
        },
      ];

      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: mockScenes });
      await store.dispatch(fetchWorldScenes({ worldName: TEST_WORLD_NAME }));

      const state = store.getState().management;
      expect(state.worldSettings.scenes.length).toBe(mockScenes.length);
    });
  });

  describe('fetchWorldPermissions', () => {
    it('should update permissions, summary, owner and set status to succeeded when fetching succeeds', async () => {
      const mockPermissions = {
        permissions: {
          deployment: {
            type: WorldPermissionType.AllowList,
            wallets: [TEST_WALLET_ADDRESS],
          },
        },
        summary: {
          deployment: 2,
        },
        owner: TEST_ADDRESS,
      } as WorldPermissionsResponse;

      mockWorldsAPI.getPermissions.mockResolvedValue(mockPermissions);
      await store.dispatch(fetchWorldPermissions({ worldName: TEST_WORLD_NAME }));

      const state = store.getState().management;
      expect(state.worldPermissions.permissions).toEqual(mockPermissions.permissions);
      expect(state.worldPermissions.summary).toEqual(mockPermissions.summary);
      expect(state.worldPermissions.owner).toBe(TEST_ADDRESS);
      expect(state.worldPermissions.status).toBe('succeeded');
      expect(state.worldPermissions.error).toBeNull();
    });

    it('should set status to failed and error message when fetching returns null', async () => {
      mockWorldsAPI.getPermissions.mockResolvedValue(null);
      await store.dispatch(fetchWorldPermissions({ worldName: TEST_WORLD_NAME }));

      const state = store.getState().management;
      expect(state.worldPermissions.status).toBe('failed');
      expect(state.worldPermissions.error).toBe('Failed to fetch world permissions');
    });

    it('should set status to failed and error message when fetching fails', async () => {
      const errorMessage = 'Permissions fetch failed';
      mockWorldsAPI.getPermissions.mockRejectedValue(new Error(errorMessage));
      await store.dispatch(fetchWorldPermissions({ worldName: TEST_WORLD_NAME })).catch(() => {});

      const state = store.getState().management;
      expect(state.worldPermissions.status).toBe('failed');
      expect(state.worldPermissions.error).toBe(errorMessage);
    });
  });

  describe('addAddressPermission', () => {
    it('should set loadingNewUser to false after adding a new user to allow list', async () => {
      store.dispatch({
        type: fetchWorldPermissions.fulfilled.type,
        payload: {
          permissions: {
            deployment: {
              type: WorldPermissionType.AllowList,
              wallets: [],
            },
          },
          summary: {},
          owner: TEST_ADDRESS,
        },
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });

      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
      mockWorldsAPI.putPermissionType.mockResolvedValue(true);
      mockWorldsAPI.getPermissions.mockResolvedValue({
        permissions: {
          deployment: {
            type: WorldPermissionType.AllowList,
            wallets: [TEST_WALLET_ADDRESS],
          },
        },
        summary: {},
        owner: TEST_ADDRESS,
      } as WorldPermissionsResponse);

      await store.dispatch(
        addAddressPermission({
          worldName: TEST_WORLD_NAME,
          permissionName: 'deployment',
          walletAddress: TEST_WALLET_ADDRESS,
        }),
      );

      const state = store.getState().management;
      expect(state.worldPermissions.loadingNewUser).toBe(false);
    });

    it('should reject with error when no connected account is found', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(null);

      const result = await store.dispatch(
        addAddressPermission({
          worldName: TEST_WORLD_NAME,
          permissionName: 'deployment',
          walletAddress: TEST_WALLET_ADDRESS,
        }),
      );

      expect(result.type).toBe('management/addAddressPermission/rejected');
    });
  });

  describe('fetchParcelsPermission', () => {
    describe('when total is less than 100', () => {
      it('should fetch all parcels in single request', async () => {
        const mockParcels = { parcels: ['0,0', '1,1', '2,2'], total: 3 };

        mockWorldsAPI.fetchParcelsPermission.mockResolvedValue(mockParcels);
        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toEqual(
          mockParcels.parcels,
        );
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledTimes(1);
      });
    });

    describe('when total is exactly 100', () => {
      it('should fetch all parcels in single request', async () => {
        const mockParcels = {
          parcels: Array.from({ length: 100 }, (_, i) => `${i},${i}`),
          total: 100,
        };

        mockWorldsAPI.fetchParcelsPermission.mockResolvedValue(mockParcels);
        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toHaveLength(100);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledTimes(1);
      });
    });

    describe('when total is 101', () => {
      it('should fetch parcels in parallel across multiple pages', async () => {
        const firstPageParcels = Array.from({ length: 100 }, (_, i) => `${i},${i}`);
        const secondPageParcels = ['100,100'];

        mockWorldsAPI.fetchParcelsPermission
          .mockResolvedValueOnce({
            parcels: firstPageParcels,
            total: 101,
          })
          .mockResolvedValueOnce({
            parcels: secondPageParcels,
            total: 101,
          });

        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toHaveLength(101);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledTimes(2);
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenNthCalledWith(
          1,
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 0 },
        );
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenNthCalledWith(
          2,
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 100 },
        );
      });
    });

    describe('when total is 500', () => {
      it('should fetch all parcels in parallel across 5 pages', async () => {
        mockWorldsAPI.fetchParcelsPermission.mockImplementation(
          async (_worldName, _permissionName, _walletAddress, params) => {
            const offset = params?.offset || 0;
            const limit = params?.limit || 100;
            const startIndex = offset;
            const endIndex = Math.min(offset + limit, 500);
            const parcels = Array.from(
              { length: endIndex - startIndex },
              (_, i) => `${startIndex + i},${startIndex + i}`,
            );
            return { parcels, total: 500 };
          },
        );

        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toHaveLength(500);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledTimes(5);
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledWith(
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 0 },
        );
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledWith(
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 100 },
        );
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledWith(
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 200 },
        );
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledWith(
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 300 },
        );
        expect(mockWorldsAPI.fetchParcelsPermission).toHaveBeenCalledWith(
          TEST_WORLD_NAME,
          'deployment',
          TEST_WALLET_ADDRESS,
          { limit: 100, offset: 400 },
        );
      });
    });

    describe('when API returns null', () => {
      it('should handle null response gracefully', async () => {
        mockWorldsAPI.fetchParcelsPermission.mockResolvedValue(null);

        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toEqual([]);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
      });
    });

    describe('when some pages fail', () => {
      it('should collect successful results and skip failed pages', async () => {
        const firstPageParcels = Array.from({ length: 100 }, (_, i) => `${i},${i}`);

        mockWorldsAPI.fetchParcelsPermission
          .mockResolvedValueOnce({
            parcels: firstPageParcels,
            total: 250,
          })
          .mockResolvedValueOnce({
            parcels: Array.from({ length: 100 }, (_, i) => `${100 + i},${100 + i}`),
            total: 250,
          })
          .mockResolvedValueOnce(null);

        await store.dispatch(
          fetchParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        );

        const state = store.getState().management;
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toHaveLength(200);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
      });
    });

    describe('worldName validation', () => {
      it('should update parcels when worldName matches', () => {
        // Dispatch pending to set the worldName
        store.dispatch({
          type: fetchParcelsPermission.pending.type,
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        // Dispatch fulfilled with matching worldName
        store.dispatch({
          type: fetchParcelsPermission.fulfilled.type,
          payload: {
            walletAddress: TEST_WALLET_ADDRESS,
            parcels: { parcels: ['0,0', '1,1', '2,2'] },
          },
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        const state = store.getState().management;
        expect(state.worldPermissions.worldName).toBe(TEST_WORLD_NAME);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toEqual([
          '0,0',
          '1,1',
          '2,2',
        ]);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('succeeded');
      });

      it('should not update parcels when worldName does not match on fulfilled', () => {
        // Set up initial state with one worldName
        store.dispatch({
          type: fetchParcelsPermission.pending.type,
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        // Try to dispatch fulfilled with a different worldName
        store.dispatch({
          type: fetchParcelsPermission.fulfilled.type,
          payload: {
            walletAddress: TEST_WALLET_ADDRESS,
            parcels: { parcels: ['0,0', '1,1', '2,2'] },
          },
          meta: {
            arg: {
              worldName: 'different-world',
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        const state = store.getState().management;
        // worldName should still be the original one
        expect(state.worldPermissions.worldName).toBe(TEST_WORLD_NAME);
        // Parcels should still be in loading state (from pending action)
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('loading');
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.parcels).toEqual([]);
      });

      it('should not update parcels when worldName does not match on rejected', () => {
        // Set up initial state with one worldName
        store.dispatch({
          type: fetchParcelsPermission.pending.type,
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        // Try to dispatch rejected with a different worldName
        store.dispatch({
          type: fetchParcelsPermission.rejected.type,
          error: { message: 'Failed to fetch parcels' },
          meta: {
            arg: {
              worldName: 'different-world',
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        const state = store.getState().management;
        // worldName should still be the original one
        expect(state.worldPermissions.worldName).toBe(TEST_WORLD_NAME);
        // Parcels should still be in loading state (should not be set to failed)
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('loading');
      });

      it('should update parcels to failed when worldName matches on rejected', () => {
        // Set up initial state
        store.dispatch({
          type: fetchParcelsPermission.pending.type,
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        // Dispatch rejected with matching worldName
        store.dispatch({
          type: fetchParcelsPermission.rejected.type,
          error: { message: 'Failed to fetch parcels' },
          meta: {
            arg: {
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            },
          },
        });

        const state = store.getState().management;
        expect(state.worldPermissions.worldName).toBe(TEST_WORLD_NAME);
        expect(state.worldPermissions.parcels[TEST_WALLET_ADDRESS]?.status).toBe('failed');
      });
    });
  });

  describe('unpublishWorldScene', () => {
    it('should call unpublishWorldScene API and refetch scenes when unpublishing succeeds', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.unpublishWorldScene.mockResolvedValueOnce(true);
      mockWorldsAPI.fetchWorldScenes.mockResolvedValueOnce({ scenes: [] });

      await store
        .dispatch(
          unpublishWorldScene({
            worldName: TEST_WORLD_NAME,
            sceneCoord: '0,0',
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.unpublishWorldScene).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        '0,0',
      );
      expect(mockWorldsAPI.fetchWorldScenes).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when unpublishing fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.unpublishWorldScene.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            unpublishWorldScene({
              worldName: TEST_WORLD_NAME,
              sceneCoord: '0,0',
            }),
          )
          .unwrap(),
      ).rejects.toThrow('Failed to unpublish world scene');

      expect(mockWorldsAPI.unpublishWorldScene).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        '0,0',
      );
    });

    it('should throw error when no connected account is found', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            unpublishWorldScene({
              worldName: TEST_WORLD_NAME,
              sceneCoord: '0,0',
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');

      expect(mockWorldsAPI.unpublishWorldScene).not.toHaveBeenCalled();
    });
  });

  describe('unpublishEntireWorld', () => {
    it('should call unpublishEntireWorld API and return refresh scenes when unpublishing succeeds', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.unpublishEntireWorld.mockResolvedValueOnce(true);

      await store
        .dispatch(
          unpublishEntireWorld({
            worldName: TEST_WORLD_NAME,
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.unpublishEntireWorld).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
      );
      expect(mockWorldsAPI.fetchWorldScenes).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when unpublishing fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.unpublishEntireWorld.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            unpublishEntireWorld({
              worldName: TEST_WORLD_NAME,
            }),
          )
          .unwrap(),
      ).rejects.toThrow();

      expect(mockWorldsAPI.unpublishEntireWorld).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
      );
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to unpublish world';
      mockWorldsAPI.unpublishEntireWorld.mockRejectedValueOnce(new Error(errorMessage));
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);

      await expect(
        store
          .dispatch(
            unpublishEntireWorld({
              worldName: TEST_WORLD_NAME,
            }),
          )
          .unwrap(),
      ).rejects.toThrow();

      expect(mockWorldsAPI.unpublishEntireWorld).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
      );
    });
  });

  describe('fetchWorlds', () => {
    it('should fetch and transform worlds successfully on first page', async () => {
      const mockWorlds = {
        worlds: [
          {
            name: 'test-world.dcl.eth',
            title: 'Test World',
            description: 'A test world',
            thumbnailHash: 'QmTestHash',
            owner: TEST_ADDRESS,
            lastDeployedAt: '2024-01-01T00:00:00Z',
            deployedScenes: 3,
          },
        ],
        total: 1,
      };

      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(mockWorlds);

      await store.dispatch(fetchWorlds({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('test-world.dcl.eth');
      expect(state.projects[0].displayName).toBe('test-world.dcl.eth');
      expect(state.projects[0].deployment?.title).toBe('Test World');
      expect(state.projects[0].deployment?.scenesCount).toBe(3);
      expect(state.total).toBe(1);
    });

    it('should append worlds when fetching subsequent pages', async () => {
      const mockPage1 = {
        worlds: [
          {
            name: 'world-1.dcl.eth',
            title: 'World 1',
            description: '',
            owner: TEST_ADDRESS,
            lastDeployedAt: '2024-01-01T00:00:00Z',
            deployedScenes: 1,
          },
        ],
        total: 2,
      };

      const mockPage2 = {
        worlds: [
          {
            name: 'world-2.dcl.eth',
            title: 'World 2',
            description: '',
            owner: TEST_ADDRESS,
            lastDeployedAt: '2024-01-02T00:00:00Z',
            deployedScenes: 2,
          },
        ],
        total: 2,
      };

      // First page (page = 0)
      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(mockPage1);
      await store.dispatch(fetchWorlds({ address: TEST_ADDRESS }));

      expect(store.getState().management.projects).toHaveLength(1);

      // Second page (page = 1)
      store.dispatch(actions.setPage(1));
      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(mockPage2);
      await store.dispatch(fetchWorlds({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.projects).toHaveLength(2);
      expect(state.projects[0].id).toBe('world-1.dcl.eth');
      expect(state.projects[1].id).toBe('world-2.dcl.eth');
      expect(state.total).toBe(2);
    });

    it('should throw error when fetchWorlds returns null', async () => {
      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(null);

      await expect(store.dispatch(fetchWorlds({ address: TEST_ADDRESS })).unwrap()).rejects.toThrow(
        'Failed to fetch worlds',
      );
    });

    it('should identify owner role correctly', async () => {
      const mockWorlds = {
        worlds: [
          {
            name: 'owner-world.dcl.eth',
            owner: TEST_ADDRESS.toLowerCase(),
            title: 'Owner World',
            description: '',
            lastDeployedAt: '2024-01-01T00:00:00Z',
            deployedScenes: 1,
          },
        ],
        total: 1,
      };

      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(mockWorlds);
      await store.dispatch(fetchWorlds({ address: TEST_ADDRESS.toUpperCase() }));

      const state = store.getState().management;
      expect(state.projects[0].role).toBe('owner');
    });

    it('should identify collaborator role correctly', async () => {
      const mockWorlds = {
        worlds: [
          {
            name: 'collab-world.dcl.eth',
            owner: '0xdifferentaddress',
            title: 'Collaborator World',
            description: '',
            lastDeployedAt: '2024-01-01T00:00:00Z',
            deployedScenes: 1,
          },
        ],
        total: 1,
      };

      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce(mockWorlds);
      await store.dispatch(fetchWorlds({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.projects[0].role).toBe('collaborator');
    });
  });

  describe('fetchEmptyWorlds', () => {
    beforeEach(() => {
      // Set up mock ENS data in state by dispatching an action
      const ensDataArray = [
        {
          subdomain: 'empty-world.dcl.eth',
          name: 'empty-world',
          nftOwnerAddress: TEST_ADDRESS,
          ensOwnerAddress: TEST_ADDRESS,
          provider: 'dcl',
          tokenId: '1',
          resolver: '0xresolver',
          content: '',
        },
        {
          subdomain: 'published-world.dcl.eth',
          name: 'published-world',
          nftOwnerAddress: TEST_ADDRESS,
          ensOwnerAddress: TEST_ADDRESS,
          provider: 'dcl',
          tokenId: '2',
          resolver: '0xresolver',
          content: '',
        },
        {
          subdomain: 'another-empty.dcl.eth',
          name: 'another-empty',
          nftOwnerAddress: '0xotheraddress',
          ensOwnerAddress: '0xotheraddress',
          provider: 'dcl',
          tokenId: '3',
          resolver: '0xresolver',
          content: '',
        },
      ];
      // Simulate ENS data being loaded
      store.dispatch({
        type: 'ens/fetchENSList/fulfilled',
        payload: ensDataArray,
        meta: { arg: { address: TEST_ADDRESS } },
      });
    });

    it('should fetch unpublished worlds by checking scene counts via API', async () => {
      // Mock API responses - empty-world has 0 scenes, published-world has 3 scenes, another-empty has 0 scenes
      mockWorldsAPI.fetchWorldScenes
        .mockResolvedValueOnce({ scenes: [], total: 0 }) // empty-world.dcl.eth
        .mockResolvedValueOnce({ scenes: [], total: 3 }) // published-world.dcl.eth (has scenes)
        .mockResolvedValueOnce({ scenes: [], total: 0 }); // another-empty.dcl.eth

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      expect(result).toHaveLength(2); // Only 2 worlds with 0 scenes
      expect(result.find((w: ManagedProject) => w.id === 'empty-world.dcl.eth')).toBeDefined();
      expect(result.find((w: ManagedProject) => w.id === 'another-empty.dcl.eth')).toBeDefined();
      expect(
        result.find((w: ManagedProject) => w.id === 'published-world.dcl.eth'),
      ).toBeUndefined();
    });

    it('should use cached scenesCount from existing projects when available', async () => {
      // Add a project with known scenesCount to state by dispatching an action
      store.dispatch({
        type: fetchWorlds.fulfilled.type,
        payload: {
          worlds: [
            {
              id: 'empty-world.dcl.eth',
              displayName: 'empty-world.dcl.eth',
              type: ManagedProjectType.WORLD,
              role: 'owner',
              deployment: {
                title: 'Empty World',
                description: '',
                thumbnail: '',
                lastPublishedAt: 0,
                scenesCount: 0, // Cached value
              },
            },
          ],
          total: 1,
        },
        meta: { arg: { address: TEST_ADDRESS } },
      });

      // Mock API for the other two worlds only (first one uses cached value)
      mockWorldsAPI.fetchWorldScenes
        .mockResolvedValueOnce({ scenes: [], total: 5 }) // published-world.dcl.eth
        .mockResolvedValueOnce({ scenes: [], total: 0 }); // another-empty.dcl.eth

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      // Should use cached value for empty-world, not call API for it
      expect(mockWorldsAPI.fetchWorldScenes).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result.find((w: ManagedProject) => w.id === 'empty-world.dcl.eth')).toBeDefined();
    });

    it('should handle API errors gracefully and assume 0 scenes', async () => {
      // Mock API to throw error for first world, return 0 for second, return 5 for third
      mockWorldsAPI.fetchWorldScenes
        .mockRejectedValueOnce(new Error('API Error')) // empty-world.dcl.eth - error = 0 scenes
        .mockResolvedValueOnce({ scenes: [], total: 3 }) // published-world.dcl.eth
        .mockResolvedValueOnce({ scenes: [], total: 0 }); // another-empty.dcl.eth

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      // Even with error, empty-world should be included (defaults to 0 scenes)
      expect(result).toHaveLength(2);
      expect(result.find((w: ManagedProject) => w.id === 'empty-world.dcl.eth')).toBeDefined();
      expect(result.find((w: ManagedProject) => w.id === 'another-empty.dcl.eth')).toBeDefined();
    });

    it('should set owner role for ENS owned by the address', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      const ownedWorld = result.find((w: ManagedProject) => w.id === 'empty-world.dcl.eth');
      expect(ownedWorld?.role).toBe('owner');
    });

    it('should set collaborator role for ENS not owned by the address', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      const collabWorld = result.find((w: ManagedProject) => w.id === 'another-empty.dcl.eth');
      expect(collabWorld?.role).toBe('collaborator');
    });

    it('should set deployment to undefined for unpublished worlds', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      expect(result[0].deployment).toBeUndefined();
    });

    it('should update state with empty projects and total', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });

      await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS }));

      const state = store.getState().management;
      expect(state.projects).toHaveLength(3); // All 3 worlds have 0 scenes
      expect(state.total).toBe(3);
    });

    it('should filter out all worlds when all have published scenes', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 5 });

      const result = await store.dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS })).unwrap();

      expect(result).toHaveLength(0);
    });

    it('should handle case-insensitive address comparison for role assignment', async () => {
      mockWorldsAPI.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });

      // Dispatch with uppercase address
      const result = await store
        .dispatch(fetchEmptyWorlds({ address: TEST_ADDRESS.toUpperCase() }))
        .unwrap();

      const ownedWorld = result.find((w: ManagedProject) => w.id === 'empty-world.dcl.eth');
      expect(ownedWorld?.role).toBe('owner');
    });
  });

  describe('updateWorldSettings', () => {
    it('should update settings and refetch when update succeeds', async () => {
      const mockSettings = { name: TEST_WORLD_NAME, description: 'Updated description' };

      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.putWorldSettings.mockResolvedValueOnce({ success: true });
      mockWorldsAPI.fetchWorldSettings.mockResolvedValueOnce(mockSettings);

      // Need to mock fetchManagedProjectsFiltered call
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.fetchWorlds.mockResolvedValueOnce({ worlds: [], total: 0 });

      await store
        .dispatch(
          updateWorldSettings({
            worldName: TEST_WORLD_NAME,
            worldSettings: { description: 'Updated description' },
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.putWorldSettings).toHaveBeenCalledWith(TEST_ADDRESS, TEST_WORLD_NAME, {
        description: 'Updated description',
      });
      expect(mockWorldsAPI.fetchWorldSettings).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should reject when no account is connected', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            updateWorldSettings({
              worldName: TEST_WORLD_NAME,
              worldSettings: {},
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');
    });

    it('should reject when API call fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.putWorldSettings.mockResolvedValueOnce({
        success: false,
        error: 'Update failed',
      });

      const result = await store.dispatch(
        updateWorldSettings({
          worldName: TEST_WORLD_NAME,
          worldSettings: {},
        }),
      );

      expect(result.meta.requestStatus).toBe('rejected');
      expect(result.payload).toEqual({ message: 'Update failed' });
    });
  });

  describe('updateWorldPermissions', () => {
    it('should call postPermissionType and refetch permissions when update succeeds', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.postPermissionType.mockResolvedValueOnce(true);
      mockWorldsAPI.getPermissions.mockResolvedValueOnce({
        permissions: { deployment: { type: WorldPermissionType.AllowList } },
        summary: {},
        owner: TEST_ADDRESS,
      });

      await store
        .dispatch(
          updateWorldPermissions({
            worldName: TEST_WORLD_NAME,
            worldPermissionName: 'deployment',
            worldPermissionType: WorldPermissionType.AllowList,
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.postPermissionType).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        'deployment',
        WorldPermissionType.AllowList,
        undefined,
      );
      expect(mockWorldsAPI.getPermissions).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when no account is connected', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            updateWorldPermissions({
              worldName: TEST_WORLD_NAME,
              worldPermissionName: 'deployment',
              worldPermissionType: WorldPermissionType.AllowList,
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.postPermissionType.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            updateWorldPermissions({
              worldName: TEST_WORLD_NAME,
              worldPermissionName: 'deployment',
              worldPermissionType: WorldPermissionType.AllowList,
            }),
          )
          .unwrap(),
      ).rejects.toThrow('Failed to update world permissions');
    });
  });

  describe('removeAddressPermission', () => {
    it('should call deletePermissionType and refetch permissions when removal succeeds', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.deletePermissionType.mockResolvedValueOnce(true);
      mockWorldsAPI.getPermissions.mockResolvedValueOnce({
        permissions: { deployment: { type: WorldPermissionType.Unrestricted } },
        summary: {},
        owner: TEST_ADDRESS,
      });

      await store
        .dispatch(
          removeAddressPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.deletePermissionType).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        'deployment',
        TEST_WALLET_ADDRESS,
      );
      expect(mockWorldsAPI.getPermissions).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when no account is connected', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            removeAddressPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.deletePermissionType.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            removeAddressPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
            }),
          )
          .unwrap(),
      ).rejects.toThrow('Failed to remove address permission');
    });
  });

  describe('addParcelsPermission', () => {
    it('should call postParcelsPermission and refetch permissions when adding parcels succeeds', async () => {
      const mockParcels = ['0,0', '1,1', '2,2'];
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.postParcelsPermission.mockResolvedValueOnce(true);
      mockWorldsAPI.getPermissions.mockResolvedValueOnce({
        permissions: { deployment: { type: WorldPermissionType.NFTOwnership } },
        summary: {},
        owner: TEST_ADDRESS,
      });

      await store
        .dispatch(
          addParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
            parcels: mockParcels,
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.postParcelsPermission).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        'deployment',
        TEST_WALLET_ADDRESS,
        mockParcels,
      );
      expect(mockWorldsAPI.getPermissions).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when no account is connected', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            addParcelsPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
              parcels: ['0,0'],
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.postParcelsPermission.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            addParcelsPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
              parcels: ['0,0'],
            }),
          )
          .unwrap(),
      ).rejects.toThrow('Failed to add parcels permission');
    });
  });

  describe('removeParcelsPermission', () => {
    it('should call deleteParcelsPermission and refetch permissions when removing parcels succeeds', async () => {
      const mockParcels = ['0,0', '1,1'];
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.deleteParcelsPermission.mockResolvedValueOnce(true);
      mockWorldsAPI.getPermissions.mockResolvedValueOnce({
        permissions: { deployment: { type: WorldPermissionType.NFTOwnership } },
        summary: {},
        owner: TEST_ADDRESS,
      });

      await store
        .dispatch(
          removeParcelsPermission({
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
            parcels: mockParcels,
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.deleteParcelsPermission).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        'deployment',
        TEST_WALLET_ADDRESS,
        mockParcels,
      );
      expect(mockWorldsAPI.getPermissions).toHaveBeenCalledWith(TEST_WORLD_NAME);
    });

    it('should throw error when no account is connected', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(null);

      await expect(
        store
          .dispatch(
            removeParcelsPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
              parcels: ['0,0'],
            }),
          )
          .unwrap(),
      ).rejects.toThrow('No connected account found');
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS);
      mockWorldsAPI.deleteParcelsPermission.mockResolvedValueOnce(false);

      await expect(
        store
          .dispatch(
            removeParcelsPermission({
              worldName: TEST_WORLD_NAME,
              permissionName: 'deployment',
              walletAddress: TEST_WALLET_ADDRESS,
              parcels: ['0,0'],
            }),
          )
          .unwrap(),
      ).rejects.toThrow('Failed to remove parcels permission');
    });
  });

  describe('selectors', () => {
    it('should return worldSettings object', () => {
      store.dispatch({
        type: fetchWorldSettings.pending.type,
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });
      store.dispatch({
        type: fetchWorldSettings.fulfilled.type,
        payload: { name: TEST_WORLD_NAME },
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });

      const worldSettings = selectors.getWorldSettings(store.getState());
      expect(worldSettings.worldName).toBe(TEST_WORLD_NAME);
      expect(worldSettings.settings.name).toBe(TEST_WORLD_NAME);
    });

    it('should return error message', () => {
      store.dispatch({
        type: 'management/fetchAllManagedProjectsData/rejected',
        error: { message: 'Test error' },
        meta: { arg: { address: TEST_ADDRESS } },
      });

      const error = selectors.getError(store.getState());
      expect(error).toBe('Test error');
    });

    it('should return worldPermissions object', () => {
      store.dispatch({
        type: fetchWorldPermissions.pending.type,
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });
      store.dispatch({
        type: fetchWorldPermissions.fulfilled.type,
        payload: {
          permissions: {
            deployment: {
              type: WorldPermissionType.Unrestricted,
            },
          },
          summary: {},
          owner: TEST_ADDRESS,
        },
        meta: { arg: { worldName: TEST_WORLD_NAME } },
      });

      const permissions = selectors.getPermissionsState(store.getState());
      expect(permissions.worldName).toBe(TEST_WORLD_NAME);
      expect(permissions.owner).toBe(TEST_ADDRESS);
    });

    it('should return parcels state for specific address', () => {
      // Dispatch pending first to set the worldName
      store.dispatch({
        type: fetchParcelsPermission.pending.type,
        meta: {
          arg: {
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          },
        },
      });

      store.dispatch({
        type: fetchParcelsPermission.fulfilled.type,
        payload: {
          walletAddress: TEST_WALLET_ADDRESS,
          parcels: { parcels: ['0,0', '1,1'] },
        },
        meta: {
          arg: {
            worldName: TEST_WORLD_NAME,
            permissionName: 'deployment',
            walletAddress: TEST_WALLET_ADDRESS,
          },
        },
      });

      const parcelsState = selectors.getParcelsStateForAddress(
        store.getState() as any,
        TEST_WALLET_ADDRESS,
      );
      expect(parcelsState).toBeDefined();
      expect(parcelsState?.parcels).toEqual(['0,0', '1,1']);
      expect(parcelsState?.status).toBe('succeeded');
    });

    it('should return undefined for non-existent address', () => {
      const parcelsState = selectors.getParcelsStateForAddress(
        store.getState() as any,
        '0xnonexistent',
      );
      expect(parcelsState).toBeUndefined();
    });
  });
});
