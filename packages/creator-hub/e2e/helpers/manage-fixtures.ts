import { randomBytes } from 'node:crypto';

import type { BrowserContext, Page, Route } from 'playwright';

import { buildMockIdentity, MOCK_ADDRESS } from './auth';

const OTHER_OWNER = '0x000000000000000000000000000000000000dead';
const LAND_REGISTRIES = [
  '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
  '0x42f4ba48791e2de32f5fbf553441c2672864bb33',
];
const MB = 1024 * 1024;

/** Which LAND fixtures (spec-00 P1–P5) the subgraph answers with. */
export type LandFixture = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
/** Which World fixtures (W1 published owner, W2 empty collaborator) the Worlds sources answer with. */
export type WorldFixture = 'W1' | 'W2';

export type ManageFixtureOptions = {
  lands?: LandFixture[];
  /** Adds this many more owned, unpublished parcels, to make the LAND list scroll. */
  extraLands?: number;
  worlds?: WorldFixture[];
  /** Answers the LAND subgraph with a 500. */
  landsFail?: boolean;
  /** Answers the Worlds list with a 500. */
  worldsFail?: boolean;
  /** Holds the LAND subgraph answer back this long. */
  landsDelayMs?: number;
  /** PNG served for every content hash, keyed by hash; `default` for the rest. */
  thumbnails: Record<string, Buffer> & { default: Buffer };
};

const parcel = (x: number, y: number, owner: string, name: string | null) => ({
  x: String(x),
  y: String(y),
  tokenId: `${x}${y}`,
  owner: { address: owner },
  updateOperator: null,
  data: name ? { name, description: null } : null,
});

const ESTATE_PARCELS = [
  [20, 20],
  [20, 21],
  [21, 20],
  [21, 21],
  [22, 20],
  [22, 21],
];

const estate = {
  id: '501',
  owner: { address: OTHER_OWNER },
  updateOperator: MOCK_ADDRESS,
  size: ESTATE_PARCELS.length,
  parcels: ESTATE_PARCELS.map(([x, y]) => ({
    x: String(x),
    y: String(y),
    tokenId: `${x}${y}`,
    updateOperator: null,
  })),
  data: { name: 'Land Name', description: null },
};

function landQueryData(lands: LandFixture[], extraLands = 0) {
  const has = (fixture: LandFixture) => lands.includes(fixture);
  const extra = Array.from({ length: extraLands }, (_, i) =>
    parcel(100 + i, 100, MOCK_ADDRESS, `Fixture Parcel ${i + 1}`),
  );
  return {
    ownerParcels: [...(has('P1') ? [parcel(96, 15, MOCK_ADDRESS, 'Land Name')] : []), ...extra],
    tenantParcels: has('P2') ? [parcel(12, -2, OTHER_OWNER, null)] : [],
    updateOperatorEstates: has('P3') ? [estate] : [],
    lessorParcels: has('P5') ? [parcel(-3, 7, MOCK_ADDRESS, 'Rented Plot')] : [],
    operatorAuthorizations: has('P4')
      ? LAND_REGISTRIES.map(tokenAddress => ({
          owner: {
            address: OTHER_OWNER,
            parcels: [parcel(40, 40, OTHER_OWNER, null)],
            estates: [],
          },
          isApproved: true,
          tokenAddress,
        }))
      : [],
    tenantEstates: [],
    lessorEstates: [],
    ownerEstates: [],
    updateOperatorParcels: [],
    ownerAuthorizations: [],
  };
}

const deployment = (id: string, pointers: string[], timestamp: number, thumbnailHash: string) => ({
  id,
  type: 'scene',
  timestamp,
  pointers,
  content: [{ file: 'thumbnail.png', hash: thumbnailHash }],
  metadata: {
    display: { title: `Scene ${id}`, navmapThumbnail: 'thumbnail.png' },
    scene: { base: pointers[0], parcels: pointers },
  },
});

function activeEntities(lands: LandFixture[], pointers: string[]) {
  const all = [
    ...(lands.includes('P1') ? [deployment('p1', ['96,15'], 2_000, 'thumb-grey')] : []),
    ...(lands.includes('P3')
      ? [
          deployment('p3a', ['20,20', '20,21'], 3_000, 'thumb-white'),
          deployment('p3b', ['22,20', '22,21'], 1_000, 'thumb-white'),
        ]
      : []),
  ];
  return all.filter(entity => entity.pointers.some(pointer => pointers.includes(pointer)));
}

type StubAnswer = { match: string; body?: unknown; status?: number; delayMs?: number };

function stubAnswers(options: ManageFixtureOptions): StubAnswer[] {
  const lands = options.lands ?? [];
  const worlds = options.worlds ?? [];
  const published = worlds.includes('W1')
    ? [
        {
          name: 'fixture-one.dcl.eth',
          owner: MOCK_ADDRESS,
          title: 'Fixture One',
          description: '',
          thumbnailHash: 'thumb-grey',
          lastDeployedAt: '2026-10-01T00:00:00Z',
          deployedScenes: 1,
        },
      ]
    : [];
  return [
    {
      match: 'subgraph.decentraland.org/land-manager',
      delayMs: options.landsDelayMs,
      ...(options.landsFail
        ? { status: 500 }
        : { body: { data: landQueryData(lands, options.extraLands) } }),
    },
    {
      match: 'subgraph.decentraland.org/rentals',
      body: { data: { tenantRentals: [], lessorRentals: [] } },
    },
    {
      match: 'getOwners',
      body: {
        data: {
          domains: [],
          nfts: worlds.includes('W2')
            ? [{ owner: { address: OTHER_OWNER }, ens: { subdomain: 'fixture-two' } }]
            : [],
        },
      },
    },
    { match: 'subgraph.decentraland.org/marketplace', body: { data: { nfts: [] } } },
    { match: 'subgraph.decentraland.org/ens', body: { data: { domains: [] } } },
    { match: '/banned-names', body: { data: [] } },
    {
      match: '/account-holdings/',
      body: { ownedMana: 0, ownedLands: lands.length, ownedNames: worlds.length },
    },
    {
      match: '/wallet/contribute',
      body: {
        domains: worlds.includes('W2')
          ? [
              {
                name: 'fixture-two.dcl.eth',
                user_permissions: ['deployment'],
                owner: OTHER_OWNER,
                size: '0',
              },
            ]
          : [],
      },
    },
    {
      match: '/stats',
      body: {
        wallet: MOCK_ADDRESS,
        dclNames: [],
        ensNames: [],
        usedSpace: String(Math.round(20.02 * MB)),
        maxAllowedSpace: String(900 * MB),
      },
    },
    {
      match: '/world/fixture-one.dcl.eth/scenes',
      body: {
        scenes: [
          { entityId: 'w1', parcels: ['0,0'], entity: { metadata: { scene: { base: '0,0' } } } },
        ],
        total: 1,
      },
    },
    { match: '/world/fixture-two.dcl.eth/scenes', body: { scenes: [], total: 0 } },
    {
      match: 'worlds-content-server.decentraland.org/worlds?',
      ...(options.worldsFail
        ? { status: 500 }
        : { body: { worlds: published, total: published.length } }),
    },
    { match: '/content/entities/active', body: activeEntities(lands, []) },
  ];
}

/**
 * Serves every Manage data source from the spec-00 fixtures: JSON through a `window.fetch`
 * stub installed before the app boots, thumbnails through network routing.
 */
export async function installManageFixtures(
  context: BrowserContext,
  options: ManageFixtureOptions,
): Promise<void> {
  const answers = stubAnswers(options);
  const entities = activeEntities(options.lands ?? [], [
    '96,15',
    ...ESTATE_PARCELS.map(([x, y]) => `${x},${y}`),
  ]);
  await context.addInitScript(
    ({ answers, entities }) => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = typeof init?.body === 'string' ? init.body : '';
        const answer = answers.find(a => url.includes(a.match) || body.includes(a.match));
        if (!answer) return realFetch(input, init);
        if (answer.delayMs) await new Promise(resolve => setTimeout(resolve, answer.delayMs));
        if (answer.status) return new Response('fixture failure', { status: answer.status });
        const payload = url.includes('/content/entities/active')
          ? entities.filter(entity =>
              entity.pointers.some(pointer => (JSON.parse(body).pointers ?? []).includes(pointer)),
            )
          : answer.body;
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };
    },
    { answers, entities },
  );
  await context.route(/\/contents\/[^/?]+$/, (route: Route) => {
    const hash = route.request().url().split('/').pop()!;
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: options.thumbnails[hash] ?? options.thumbnails.default,
    });
  });
}

/** Signs the window in as {@link MOCK_ADDRESS} by seeding the auth storage, then reloads it. */
export async function signInWithMockIdentity(page: Page): Promise<void> {
  const mock = buildMockIdentity(MOCK_ADDRESS);
  const identity = {
    ...mock,
    ephemeralIdentity: {
      ...mock.ephemeralIdentity,
      privateKey: `0x${randomBytes(32).toString('hex')}`,
    },
  };
  await page.evaluate(
    ({ address, identity }) => {
      localStorage.setItem('auth-server-provider-address', address);
      localStorage.setItem(`single-sign-on-${address.toLowerCase()}`, JSON.stringify(identity));
    },
    { address: MOCK_ADDRESS, identity },
  );
  await page.reload();
}
