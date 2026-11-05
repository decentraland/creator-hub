import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUser } from '@sentry/electron/renderer';
import { ChainId, type Avatar } from '@dcl/schemas';

import { auth } from '#preload';
import { useDispatch } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { AuthServerProvider } from '/@/lib/auth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { fetchENSList } from '/@/modules/store/ens';
import type { ENS } from '/@/modules/store/ens/types';
import { fetchLandList } from '/@/modules/store/land';
import { fetchAllManagedProjectsData, fetchLandProjects } from '/@/modules/store/management';
import { toLandProject } from '/@/modules/store/management/utils';
import { fetchAnalytics } from '/@/modules/store/placeAnalytics';

import { createTestStore } from '../../../tests/utils/testStore';
import { AuthProvider } from './component';

const ACCOUNT_A = '0x00000000000000000000000000000000000000a1';
const ACCOUNT_B = '0x00000000000000000000000000000000000000b2';

vi.mock('/@/lib/auth', () => ({
  SignInError: class extends Error {},
  AuthServerProvider: class {
    static setAuthServerUrl = vi.fn();
    static setAuthDappUrl = vi.fn();
    static hasValidIdentity = vi.fn();
    static getAccount = vi.fn();
    static deactivate = vi.fn();
    static createSignInRequest = vi.fn();
    static applyDeepLinkIdentity = vi.fn();
    static openAuthDapp = vi.fn();
    request = vi.fn(async () => null);
  },
}));

const profileRequests: Array<{ address: string; answer: (avatar: Avatar) => void }> = [];

vi.mock('/@/lib/profile', () => ({
  Profiles: class {
    fetchProfile = (address: string) =>
      new Promise(answer => profileRequests.push({ address, answer }));
  },
}));

vi.mock('@sentry/electron/renderer', async importOriginal => ({
  ...((await importOriginal()) as object),
  setUser: vi.fn(),
}));

const avatarOf = (address: string) => ({ name: address }) as Avatar;

vi.mock('/@/modules/store/land', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchTiles: () => ({ type: 'test/fetchTiles' }),
}));

vi.mock('/@/modules/store/management', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchAllManagedProjectsData: vi.fn(),
}));

const landOf = (owner: string): Land => ({
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: null,
  owner,
  operators: [],
  updateOperator: null,
  deployable: true,
});

function seedWalletState(store: ReturnType<typeof createTestStore>, address: string) {
  const land = landOf(address);
  store.dispatch(fetchLandList.pending('seed', { address }));
  store.dispatch(
    fetchLandList.fulfilled({ land: [land], authorizations: [], rentals: [] }, 'seed', { address }),
  );
  store.dispatch(fetchLandProjects.pending('seed'));
  store.dispatch(
    fetchLandProjects.fulfilled(
      { projects: [toLandProject(land, [], hash => hash)], deployments: {} },
      'seed',
    ),
  );
  store.dispatch(fetchENSList.pending('seed', { address }));
  store.dispatch(fetchENSList.fulfilled([{ subdomain: 'a.dcl.eth' } as ENS], 'seed', { address }));
  store.dispatch(fetchAnalytics.pending('seed'));
  store.dispatch(
    fetchAnalytics.fulfilled(
      {
        exportedAt: '2026-11-01T00:00:00.000Z',
        places: [
          {
            placeId: land.id,
            name: 'Land Name',
            thumbnail: '',
            location: { x: 96, y: 15 },
            publishedIn: 'Genesis City',
            lastUpdatedAt: null,
          },
        ],
        metricsByPlaceId: {},
      },
      'seed',
    ),
  );
}

let session: ReturnType<typeof useAuth>;

function SessionProbe() {
  session = useAuth();
  const dispatch = useDispatch();
  const { wallet } = session;
  useEffect(() => {
    if (wallet) dispatch(fetchLandList.pending(`page-${wallet}`, { address: wallet }));
  }, [wallet, dispatch]);
  return null;
}

describe('AuthProvider', () => {
  let store: ReturnType<typeof createTestStore>;
  let fetches: Array<{ address: string; landsAtDispatch: number }>;
  let completeDeepLink: (link: { identityId: string; authRequestId: string }) => void;

  beforeEach(async () => {
    fetches = [];
    profileRequests.length = 0;
    vi.mocked(fetchAllManagedProjectsData).mockImplementation((({ address }: { address: string }) =>
      (_dispatch: unknown, getState: () => ReturnType<typeof store.getState>) => {
        fetches.push({ address, landsAtDispatch: getState().land.data.length });
      }) as never);
    vi.mocked(AuthServerProvider.hasValidIdentity).mockReturnValue(true);
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue(ACCOUNT_A);
    vi.mocked(AuthServerProvider.createSignInRequest).mockResolvedValue({
      requestId: 'sign-in',
      verifier: 'verifier',
    });
    vi.mocked(auth.onDeepLinkSignIn).mockImplementation(listener => {
      completeDeepLink = listener as typeof completeDeepLink;
      return { cleanup: vi.fn() };
    });

    store = createTestStore();
    render(
      <Provider store={store as never}>
        <MemoryRouter>
          <AuthProvider>
            <SessionProbe />
          </AuthProvider>
        </MemoryRouter>
      </Provider>,
    );
    await vi.waitFor(() => expect(fetches).toEqual([{ address: ACCOUNT_A, landsAtDispatch: 0 }]));
    act(() => seedWalletState(store, ACCOUNT_A));
  });

  afterEach(cleanup);

  describe('when the wallet changes from A to B without signing out', () => {
    beforeEach(async () => {
      vi.mocked(AuthServerProvider.applyDeepLinkIdentity).mockResolvedValue(ACCOUNT_B);
      await act(() => session.signIn());
      await act(async () => completeDeepLink({ identityId: 'id', authRequestId: 'sign-in' }));
      await vi.waitFor(() => expect(fetches).toHaveLength(2));
    });

    it("should drop A's LANDs, NAMEs, Manage lists and analytics", () => {
      const state = store.getState();
      expect(state.land.data).toEqual([]);
      expect(state.management.lands.projects).toEqual([]);
      expect(state.ens.data).toEqual({});
      expect(state.placeAnalytics.places).toEqual([]);
    });

    it("should fetch B's data only after the reset", () => {
      expect(fetches[1]).toEqual({ address: ACCOUNT_B, landsAtDispatch: 0 });
    });

    it("should keep a page's own fetch for B, started as B arrived", () => {
      expect(store.getState().land.requestIds).toEqual([`page-${ACCOUNT_B}`]);
    });

    it('should identify the session as B', () => {
      expect(store.getState().analytics.userId).toBe(ACCOUNT_B);
    });

    describe("and A's avatar arrives after B's", () => {
      beforeEach(async () => {
        const answerFor = (address: string) =>
          profileRequests.find(request => request.address === address)!.answer;
        await act(async () => answerFor(ACCOUNT_B)(avatarOf(ACCOUNT_B)));
        await act(async () => answerFor(ACCOUNT_A)(avatarOf(ACCOUNT_A)));
      });

      it("should keep B's avatar", () => {
        expect(session.avatar).toEqual(avatarOf(ACCOUNT_B));
      });
    });
  });

  describe('when signing out', () => {
    beforeEach(() => {
      act(() => session.signOut());
    });

    it("should drop A's wallet-scoped data, its analytics identity included", () => {
      const state = store.getState();
      expect(state.land.data).toEqual([]);
      expect(state.management.lands.projects).toEqual([]);
      expect(state.ens.data).toEqual({});
      expect(state.placeAnalytics.places).toEqual([]);
      expect(state.analytics.userId).toBeNull();
    });

    it('should fetch nothing', () => {
      expect(fetches).toHaveLength(1);
    });

    it('should clear the Sentry user', () => {
      expect(setUser).toHaveBeenLastCalledWith(null);
    });
  });

  describe('when only the network changes', () => {
    beforeEach(async () => {
      await act(() => session.changeNetwork(ChainId.ETHEREUM_SEPOLIA));
      await vi.waitFor(() => expect(fetches).toHaveLength(2));
    });

    it("should keep A's data while refetching it", () => {
      expect(fetches[1]).toEqual({ address: ACCOUNT_A, landsAtDispatch: 1 });
      expect(store.getState().ens.chainId).toBe(ChainId.ETHEREUM_SEPOLIA);
    });
  });
});
