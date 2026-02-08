import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import { AuthServerProvider } from 'decentraland-connect';
import { ManagedProjectType, SortBy } from '../../../../../shared/types/manage';
import type { AppState } from '../index';
import { createTestStore } from '../../../../tests/utils/testStore';
import {
  actions,
  initialState,
  selectors,
  fetchManagedProjects,
  fetchAllManagedProjectsDetails,
  fetchStorageStats,
  fetchAccountHoldings,
  fetchWorldSettings,
  fetchWorldScenes,
  fetchWorldPermissions,
  addAddressPermission,
  fetchParcelsPermission,
  unpublishWorldScene,
  updateWorldPermissions,
  removeAddressPermission,
  addParcelsPermission,
  removeParcelsPermission,
} from './slice';

const TEST_ADDRESS = '0x123abc';
const TEST_CHAIN_ID = ChainId.ETHEREUM_MAINNET;
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

const WorldRoleType = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
} as const;

const createMockWorldsAPI = () => ({
  fetchWorld: vi.fn(),
  fetchWorldScenes: vi.fn(),
  fetchWorldSettings: vi.fn(),
  fetchWalletStats: vi.fn(),
  getContentSrcUrl: vi.fn((hash: string) => `https://content.com/${hash}`),
  unpublishWorldScene: vi.fn(),
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
    fetchENSList: vi.fn().mockImplementation(({ address, chainId }) => ({
      type: 'ens/fetchENSList/fulfilled',
      meta: { arg: { address, chainId } },
      unwrap: () => Promise.resolve([]),
    })),
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
      expect(initialState.searchQuery).toBe('');
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

    it('should update searchQuery state', () => {
      const testQuery = 'test search';
      store.dispatch(actions.setSearchQuery(testQuery));
      const state = store.getState().management;
      expect(state.searchQuery).toBe(testQuery);
    });

    it('should clear error', () => {
      store.dispatch({
        type: fetchManagedProjects.rejected.type,
        error: { message: 'Test error' },
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

  describe('fetchManagedProjects', () => {
    it('should set status to loading and clear error when pending', () => {
      store.dispatch({
        type: fetchManagedProjects.pending.type,
        meta: { arg: { address: TEST_ADDRESS, chainId: TEST_CHAIN_ID } },
      });
      const state = store.getState().management;
      expect(state.status).toBe('loading');
      expect(state.error).toBeNull();
    });

    it('should set status to succeeded and clear error when fulfilled', () => {
      store.dispatch({
        type: fetchManagedProjects.fulfilled.type,
        payload: [],
        meta: { arg: { address: TEST_ADDRESS, chainId: TEST_CHAIN_ID } },
      });
      const state = store.getState().management;
      expect(state.status).toBe('succeeded');
      expect(state.error).toBeNull();
    });

    it('should set status to failed and error message when rejected', () => {
      const errorMessage = 'Failed to fetch';
      store.dispatch({
        type: fetchManagedProjects.rejected.type,
        error: { message: errorMessage },
        meta: { arg: { address: TEST_ADDRESS, chainId: TEST_CHAIN_ID } },
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
        } as any,
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

      vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS as any);
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
    it('should update parcels array and set status to succeeded', async () => {
      const mockParcels = { parcels: ['0,0', '1,1', '2,2'] };

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
    });
  });

  describe('unpublishWorldScene', () => {
    it('should call unpublishWorldScene API and return true when unpublishing succeeds', async () => {
      mockWorldsAPI.unpublishWorldScene.mockResolvedValueOnce(true);

      const result = await store
        .dispatch(
          unpublishWorldScene({
            address: TEST_ADDRESS,
            worldName: TEST_WORLD_NAME,
            sceneCoords: '0,0',
          }),
        )
        .unwrap();

      expect(mockWorldsAPI.unpublishWorldScene).toHaveBeenCalledWith(
        TEST_ADDRESS,
        TEST_WORLD_NAME,
        '0,0',
      );
      expect(result).toBe(true);
    });

    it('should return false when unpublishing fails', async () => {
      mockWorldsAPI.unpublishWorldScene.mockResolvedValueOnce(false);

      const result = await store
        .dispatch(
          unpublishWorldScene({
            address: TEST_ADDRESS,
            worldName: TEST_WORLD_NAME,
            sceneCoords: '0,0',
          }),
        )
        .unwrap();

      expect(result).toBe(false);
    });
  });

  describe('updateWorldPermissions', () => {
    it('should call postPermissionType and refetch permissions when update succeeds', async () => {
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(TEST_ADDRESS as any);
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
    it('should return projects array', () => {
      store.dispatch({
        type: fetchAllManagedProjectsDetails.fulfilled.type,
        payload: [
          {
            id: 'project1',
            displayName: 'Project 1',
            type: ManagedProjectType.WORLD,
            role: WorldRoleType.OWNER,
          },
        ],
      });

      const projects = selectors.getManagedProjects(store.getState() as AppState);
      expect(projects.length).toBe(1);
      expect(projects[0]?.id).toBe('project1');
    });

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

      const worldSettings = selectors.getWorldSettings(store.getState() as AppState);
      expect(worldSettings.worldName).toBe(TEST_WORLD_NAME);
      expect(worldSettings.settings.name).toBe(TEST_WORLD_NAME);
    });

    it('should return error message', () => {
      store.dispatch({
        type: fetchManagedProjects.rejected.type,
        error: { message: 'Test error' },
      });

      const error = selectors.getError(store.getState() as AppState);
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

      const permissions = selectors.getPermissionsState(store.getState() as AppState);
      expect(permissions.worldName).toBe(TEST_WORLD_NAME);
      expect(permissions.owner).toBe(TEST_ADDRESS);
    });

    it('should return parcels state for specific address', () => {
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
        store.getState() as AppState,
        TEST_WALLET_ADDRESS,
      );
      expect(parcelsState).toBeDefined();
      expect(parcelsState?.parcels).toEqual(['0,0', '1,1']);
      expect(parcelsState?.status).toBe('succeeded');
    });

    it('should return undefined for non-existent address', () => {
      const parcelsState = selectors.getParcelsStateForAddress(
        store.getState() as AppState,
        '0xnonexistent',
      );
      expect(parcelsState).toBeUndefined();
    });
  });
});
