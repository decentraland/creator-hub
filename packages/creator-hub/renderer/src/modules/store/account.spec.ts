import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthServerProvider } from '/@/lib/auth';
import { LandType, RoleType, type Authorization, type Land } from '/@/lib/land';
import { fetchAnalytics as fetchAnalyticsSnapshot } from '/@/lib/placeAnalytics';
import type * as ManagementUtils from '/@/modules/store/management/utils';
import { createTestStore } from '../../../tests/utils/testStore';
import { accountChanged } from './account';
import { fetchLandProjects } from './management';
import { fetchAnalytics } from './placeAnalytics';

const PREVIOUS_ACCOUNT = '0x00000000000000000000000000000000000000a1';

const previousAccountLand: Land = {
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Previous Land',
  description: null,
  owner: PREVIOUS_ACCOUNT,
  operators: [],
  updateOperator: null,
};

const landAnswers: Array<(answer: [Land[], Authorization[]]) => void> = [];

vi.mock('/@/lib/auth', () => ({ AuthServerProvider: { getAccount: vi.fn() } }));

vi.mock('/@/lib/land', async importOriginal => ({
  ...((await importOriginal()) as object),
  Lands: class {
    fetchLand = () => new Promise(resolve => landAnswers.push(resolve));
    fetchLandPublishedScenes = async () => [];
    getContentSrcUrl = (hash: string) => hash;
  },
  Rentals: class {
    fetchRentalTokenIds = async () => ({ tenantRentals: [], lessorRentals: [] });
  },
}));

vi.mock('/@/lib/placeAnalytics', () => ({ fetchAnalytics: vi.fn() }));

vi.mock('/@/modules/store/management/utils', async importOriginal => ({
  ...(await importOriginal<typeof ManagementUtils>()),
  fetchAllDeployedWorlds: vi.fn(async () => []),
}));

describe('when the account changes while the previous account LAND list is in flight', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    landAnswers.length = 0;
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue(PREVIOUS_ACCOUNT);
    vi.mocked(fetchAnalyticsSnapshot).mockImplementation(async (_projects, lands) => ({
      exportedAt: '2026-11-01T00:00:00.000Z',
      places: lands.map(land => ({
        placeId: land.id,
        name: land.name ?? land.id,
        thumbnail: '',
        location: { x: land.x ?? 0, y: land.y ?? 0 },
      })),
      metricsByPlaceId: {},
    }));
    store = createTestStore();

    const landProjects = store.dispatch(fetchLandProjects());
    const analytics = store.dispatch(fetchAnalytics());
    await vi.waitFor(() => expect(landAnswers).toHaveLength(2));

    store.dispatch(accountChanged());
    landAnswers.forEach(answer => answer([[previousAccountLand], []]));
    await Promise.all([landProjects, analytics]);
  });

  it('should keep the late answer out of the LAND list', () => {
    expect(store.getState().land.data).toEqual([]);
  });

  it('should keep the late answer out of the Manage LANDS list', () => {
    expect(store.getState().management.lands.projects).toEqual([]);
  });

  it('should keep the late answer out of the analytics places', () => {
    expect(store.getState().placeAnalytics.places).toEqual([]);
  });
});
