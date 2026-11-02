import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { metrics } from '#preload';
import { AuthServerProvider } from '/@/lib/auth';
import { actions as placeAnalyticsActions, selectors } from '/@/modules/store/placeAnalytics';

import { createTestStore, type TestStore } from '../../../tests/utils/testStore';

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';
const WORLD_COUNT = 120;
const GENESIS_COUNT = 80;
const TOTAL = WORLD_COUNT + GENESIS_COUNT;

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

vi.mock('/@/lib/auth', () => ({
  AuthServerProvider: { getAccount: vi.fn(() => '0x1234567890123456789012345678901234567890') },
}));

vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => ({ isSignedIn: true }) }));

/** The navbar's avatar reads theme tokens this environment does not populate, and
 * nothing here is about the navbar. `NavbarItem` stays real — it is an enum the
 * page reads. */
vi.mock('../Navbar', async importOriginal => ({
  ...((await importOriginal()) as object),
  Navbar: () => null,
}));

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: () => ({
    ephemeralIdentity: { address: '0x1234567890123456789012345678901234567890' },
  }),
}));

/**
 * `lib/worlds` imports this module's *default* export as its fetch, so the mock
 * has to keep one — a factory replaces the whole module, and an absent default
 * leaves `worlds.ts` calling undefined.
 */
vi.mock('decentraland-crypto-fetch', () => ({
  default: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
  signedHeaderFactory: () => () => new Map([['x-identity-auth-chain-0', 'stub']]),
}));

/**
 * LAND discovery goes through the rentals and LAND subgraphs, which this suite
 * is not exercising: the parcels are handed over directly so the scenes
 * deployed on them still resolve for real.
 */
vi.mock('/@/modules/store/land', async importOriginal => {
  const actual = (await importOriginal()) as object;
  const land = Array.from({ length: 80 }, (_, index) => ({
    id: `parcel-${index}`,
    x: index,
    y: 0,
  }));
  return {
    ...actual,
    fetchLandList: vi.fn(() => () => {
      const dispatched = Promise.resolve({ land }) as Promise<{ land: unknown[] }> & {
        unwrap: () => Promise<{ land: unknown[] }>;
      };
      dispatched.unwrap = () => Promise.resolve({ land });
      return dispatched;
    }),
  };
});

const WORLDS = Array.from({ length: WORLD_COUNT }, (_, index) => ({
  name: `world-${String(index).padStart(3, '0')}.dcl.eth`,
  owner: TEST_ADDRESS,
  title: `World ${index}`,
  description: '',
  thumbnail_hash: null,
  last_deployed_at: '2026-08-01T00:00:00Z',
  deployed_scenes: 1,
}));

const json = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

/** The three services the list is assembled from, answering at full scale. */
function installNetwork() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/worlds?')) {
        const params = new URL(url).searchParams;
        const offset = Number(params.get('offset') ?? 0);
        const limit = Number(params.get('limit') ?? 100);
        return Promise.resolve(
          json({ worlds: WORLDS.slice(offset, offset + limit), total: WORLDS.length }),
        );
      }

      if (url.includes('/scenes?')) {
        const world = decodeURIComponent(url.split('/world/')[1].split('/scenes')[0]);
        const index = Number(world.match(/world-(\d+)/)?.[1] ?? 0);
        return Promise.resolve(
          json({
            scenes: [{ parcels: [], entity: { metadata: { scene: { base: `${index},1` } } } }],
            total: 1,
          }),
        );
      }

      if (url.includes('/content/entities/active')) {
        const pointers: string[] = JSON.parse(String(init?.body)).pointers;
        return Promise.resolve(
          json(
            pointers.map(pointer => ({
              id: `scene-${pointer}`,
              timestamp: 1_700_000_000_000,
              metadata: { scene: { base: pointer }, display: { title: `Genesis ${pointer}` } },
            })),
          ),
        );
      }

      return Promise.reject(new Error(`unstubbed request: ${url}`));
    }),
  );
}

/** Answers each batched metrics request positionally, as the service does. */
function installMetrics() {
  vi.mocked(metrics.request).mockImplementation(
    (request: any) =>
      Promise.resolve({
        ok: true,
        data: {
          exported_at: '2026-08-14T00:00:00.000Z',
          source: 'test',
          locations: request.body.locations.map((location: any, index: number) => ({
            ...location,
            location_key: `key-${index}`,
            builder_project_id: null,
            metrics: { unique_visits_60d: [{ series: 'all', period: null, value: 10 }] },
          })),
        },
      }) as any,
  );
}

describe('the analytics list at full scale', () => {
  let store: TestStore;

  beforeEach(() => {
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
    installNetwork();
    installMetrics();
    store = createTestStore();
  });

  describe('when the wallet holds more scenes than any one request returns', () => {
    it('should answer with every scene, worlds and Genesis City alike', async () => {
      await store.dispatch(placeAnalyticsActions.fetchAnalytics() as never);

      const { places, status } = store.getState().placeAnalytics;
      expect(status).toBe('succeeded');
      expect(places).toHaveLength(TOTAL);
      expect(places.filter(place => place.location.world)).toHaveLength(WORLD_COUNT);
      expect(places.filter(place => !place.location.world)).toHaveLength(GENESIS_COUNT);
    });

    it('should page the worlds list rather than stopping at the first page', async () => {
      await store.dispatch(placeAnalyticsActions.fetchAnalytics() as never);

      const worldsCalls = vi
        .mocked(globalThis.fetch)
        .mock.calls.filter(([url]) => String(url).includes('/worlds?'));

      expect(worldsCalls.length).toBeGreaterThan(1);
      expect(store.getState().placeAnalytics.places.at(-1)).toBeDefined();
    });

    it('should batch the metrics request and keep every answer with what it asked for', async () => {
      await store.dispatch(placeAnalyticsActions.fetchAnalytics() as never);

      const batches = vi.mocked(metrics.request).mock.calls.map(([request]: any) => request);
      expect(batches).toHaveLength(Math.ceil(TOTAL / 100));

      const { places, metricsByPlaceId } = store.getState().placeAnalytics;
      for (const place of places) {
        const answer = metricsByPlaceId[place.placeId];
        expect(answer).toBeDefined();
        expect({ x: answer.x, y: answer.y }).toEqual({ x: place.location.x, y: place.location.y });
      }
    });

    it('should render a row for every scene, not just the first batch', async () => {
      await store.dispatch(placeAnalyticsActions.fetchAnalytics() as never);

      expect(selectors.getVisiblePlaces(store.getState())).toHaveLength(TOTAL);
    });
  });

  describe('when one world cannot be listed', () => {
    beforeEach(() => {
      const failing = 'world-042.dcl.eth';
      const realFetch = globalThis.fetch;
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
          String(input).includes(encodeURIComponent(failing))
            ? Promise.resolve({ ok: false, status: 503 })
            : (realFetch as any)(input, init),
        ),
      );
    });

    it('should fail loudly rather than answer with a shorter list', async () => {
      await store.dispatch(placeAnalyticsActions.fetchAnalytics() as never);

      const { status, error, places } = store.getState().placeAnalytics;
      expect(status).toBe('failed');
      expect(error).toMatch(/world-042\.dcl\.eth/);
      expect(places).toHaveLength(0);
    });
  });
});

describe('the analytics page at full scale', () => {
  let store: TestStore;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>
      <ThemeProvider theme={dark}>
        <MemoryRouter>{children}</MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

  beforeEach(() => {
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue(TEST_ADDRESS);
    installNetwork();
    installMetrics();
    store = createTestStore();
  });

  it('should put every scene on screen once the snapshot arrives', async () => {
    const { AnalyticsPage } = await import('./component');

    render(<AnalyticsPage />, { wrapper });

    await waitFor(() => expect(store.getState().placeAnalytics.status).toBe('succeeded'), {
      timeout: 15_000,
    });

    await waitFor(() =>
      expect(screen.getByText('world-000.dcl.eth', { exact: false })).toBeDefined(),
    );
    expect(screen.getByText('world-119.dcl.eth', { exact: false })).toBeDefined();
  }, 30_000);
});
