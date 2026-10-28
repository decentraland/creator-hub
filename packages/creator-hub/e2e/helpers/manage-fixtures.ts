import { randomBytes } from 'node:crypto';

import type { BrowserContext, ElectronApplication, Page, Route } from 'playwright';
import { encodeAbiParameters, keccak256, namehash, toBytes, toFunctionSelector } from 'viem';

import { buildMockIdentity, MOCK_ADDRESS } from './auth';

const OTHER_OWNER = '0x000000000000000000000000000000000000dead';
const LAND_REGISTRIES = [
  '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
  '0x42f4ba48791e2de32f5fbf553441c2672864bb33',
];
const MB = 1024 * 1024;

/** Fake accounts with fake profiles, for collaborators, managers and recipients. */
export const FIXTURE_ACCOUNTS = {
  ana: '0x00000000000000000000000000000000000000a1',
  ben: '0x00000000000000000000000000000000000000b2',
  cal: '0x00000000000000000000000000000000000000c3',
  dee: '0x00000000000000000000000000000000000000d1',
  dan: '0x00000000000000000000000000000000000000d2',
} as const;

const PROFILE_NAMES: Record<string, string> = {
  [FIXTURE_ACCOUNTS.ana]: 'Fixture Ana',
  [FIXTURE_ACCOUNTS.ben]: 'Fixture Ben',
  [FIXTURE_ACCOUNTS.cal]: 'Fixture Cal',
  [FIXTURE_ACCOUNTS.dee]: 'Fixture Dee',
  [FIXTURE_ACCOUNTS.dan]: 'Fixture Dan',
};

const NAME_CONTENT = '0xe30101701220a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f';
const ESTATE_REGISTRY = '0x959e104e1a4db6317fa58f8295f586e1a978c297';

/** Which LAND fixtures (spec-00 P1–P5) the subgraph answers with. */
export type LandFixture = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
/**
 * Which World fixtures (W1 published owner, W2 empty collaborator, W3 published stream-only,
 * W4 published deploy collaborator) the Worlds sources answer with.
 */
export type WorldFixture = 'W1' | 'W2' | 'W3' | 'W4';

type RelayOutcome = 'sign' | 'reject' | 'expire';

export type ManageFixtureOptions = {
  lands?: LandFixture[];
  /** Adds this many more owned, unpublished parcels, to make the LAND list scroll. */
  extraLands?: number;
  worlds?: WorldFixture[];
  /** Answers the LAND subgraph with a 500. */
  landsFail?: boolean;
  /** Answers the Worlds list with a 500. */
  worldsFail?: boolean;
  /** Answers W1's settings without a thumbnail. */
  worldNoThumbnail?: boolean;
  /** Holds the LAND subgraph answer back this long. */
  landsDelayMs?: number;
  /** PNG served for every content hash, keyed by hash; `default` for the rest. */
  thumbnails: Record<string, Buffer> & { default: Buffer };
  /** Gives P1 the collaborator Fixture Ana. */
  p1Operator?: boolean;
  /** Adds P6: an owned estate with an estate-wide and two per-parcel collaborators. */
  ownedEstate?: boolean;
  /** Fixture Dee manages both registries, Fixture Dan only the LAND one. */
  managers?: boolean;
  /** The NAMEs fixtureone (used by World W1) and fixturethree, the latter linked to P1 when `set`. */
  names?: 'owned' | 'set';
  /** How the auth relay answers a transaction request, after `delayMs`. */
  relay?: {
    outcome: RelayOutcome | RelayOutcome[];
    delayMs?: number;
  };
  /** The receipt the RPC returns once `delayMs` passed since the first poll. */
  receipt?: { status: 'success' | 'revert' | 'none'; delayMs?: number };
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

const OWNED_ESTATE_PARCELS = [
  [60, 60],
  [60, 61],
  [61, 60],
  [61, 61],
];

const ownedEstate = {
  id: '777',
  owner: { address: MOCK_ADDRESS },
  updateOperator: FIXTURE_ACCOUNTS.cal,
  size: OWNED_ESTATE_PARCELS.length,
  parcels: OWNED_ESTATE_PARCELS.map(([x, y], index) => ({
    x: String(x),
    y: String(y),
    tokenId: `${x}${y}`,
    updateOperator: index < 2 ? FIXTURE_ACCOUNTS.ana : index === 2 ? FIXTURE_ACCOUNTS.ben : null,
  })),
  data: { name: 'Owned Estate', description: 'Four parcels by the plaza' },
};

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

function landQueryData(lands: LandFixture[], options: ManageFixtureOptions) {
  const has = (fixture: LandFixture) => lands.includes(fixture);
  const extra = Array.from({ length: options.extraLands ?? 0 }, (_, i) =>
    parcel(100 + i, 100, MOCK_ADDRESS, `Fixture Parcel ${i + 1}`),
  );
  const p1 = {
    ...parcel(96, 15, MOCK_ADDRESS, 'Land Name'),
    updateOperator: options.p1Operator ? FIXTURE_ACCOUNTS.ana : null,
  };
  return {
    ownerParcels: [...(has('P1') ? [p1] : []), ...extra],
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
    ownerEstates: options.ownedEstate ? [ownedEstate] : [],
    updateOperatorParcels: [],
    ownerAuthorizations: options.managers
      ? [
          { operator: FIXTURE_ACCOUNTS.dee, isApproved: true, tokenAddress: LAND_REGISTRIES[0] },
          { operator: FIXTURE_ACCOUNTS.dee, isApproved: true, tokenAddress: ESTATE_REGISTRY },
          { operator: FIXTURE_ACCOUNTS.dan, isApproved: true, tokenAddress: LAND_REGISTRIES[0] },
        ]
      : [],
  };
}

const deployment = (
  id: string,
  title: string,
  pointers: string[],
  timestamp: number,
  thumbnailHash: string,
) => ({
  id,
  type: 'scene',
  timestamp,
  pointers,
  content: [{ file: 'thumbnail.png', hash: thumbnailHash }],
  metadata: {
    display: { title, navmapThumbnail: 'thumbnail.png' },
    scene: { base: pointers[0], parcels: pointers },
  },
});

function activeEntities(lands: LandFixture[], pointers: string[]) {
  const all = [
    ...(lands.includes('P1')
      ? [deployment('p1', 'Scene A', ['96,15'], Date.UTC(2026, 9, 24, 15, 40), 'thumb-grey')]
      : []),
    ...(lands.includes('P5')
      ? [deployment('p5', 'Scene D', ['-3,7'], Date.UTC(2026, 8, 30, 9, 5), 'thumb-grey')]
      : []),
    ...(lands.includes('P3')
      ? [
          deployment(
            'p3a',
            'Scene B',
            ['20,20', '20,21'],
            Date.UTC(2026, 9, 26, 11, 20),
            'thumb-white',
          ),
          deployment(
            'p3b',
            'Scene C',
            ['22,20', '22,21'],
            Date.UTC(2026, 9, 12, 18, 0),
            'thumb-white',
          ),
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
          name: 'fixtureone.dcl.eth',
          owner: MOCK_ADDRESS,
          title: 'Fixture One',
          description: '',
          thumbnailHash: 'thumb-grey',
          lastDeployedAt: '2026-10-01T00:00:00Z',
          deployedScenes: 1,
        },
      ]
    : [];
  if (worlds.includes('W4')) {
    published.push({
      name: 'fixture-team.dcl.eth',
      owner: OTHER_OWNER,
      title: 'Fixture Team',
      description: '',
      thumbnailHash: 'thumb-grey',
      lastDeployedAt: '2026-09-01T00:00:00Z',
      deployedScenes: 1,
    });
  }
  return [
    {
      match: 'subgraph.decentraland.org/land-manager',
      delayMs: options.landsDelayMs,
      ...(options.landsFail ? { status: 500 } : { body: { data: landQueryData(lands, options) } }),
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
    {
      match: 'owner_',
      body: {
        data: {
          nfts: options.names
            ? [{ ens: { subdomain: 'fixtureone' } }, { ens: { subdomain: 'fixturethree' } }]
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
        domains: [
          ...(worlds.includes('W2')
            ? [
                {
                  name: 'fixture-two.dcl.eth',
                  user_permissions: ['deployment'],
                  owner: OTHER_OWNER,
                  size: '0',
                },
              ]
            : []),
          ...(worlds.includes('W3')
            ? [
                {
                  name: 'fixture-stream.dcl.eth',
                  user_permissions: ['streaming'],
                  owner: OTHER_OWNER,
                  size: '0',
                },
              ]
            : []),
        ],
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
      match: '/lands/redirectionHashes',
      body: {
        ok: true,
        data: options.names === 'set' ? [{ x: 96, y: 15, contentHash: NAME_CONTENT.slice(2) }] : [],
      },
    },
    { match: '/redirection', body: { ok: true, data: { contentHash: NAME_CONTENT.slice(2) } } },
    {
      match: '/world/fixtureone.dcl.eth/scenes',
      body: {
        scenes: [
          { entityId: 'w1', parcels: ['0,0'], entity: { metadata: { scene: { base: '0,0' } } } },
        ],
        total: 1,
      },
    },
    {
      match: '/world/fixtureone.dcl.eth/settings',
      body: {
        title: 'Fixture One',
        description: 'A fixture World for screenshots.',
        categories: ['social', 'music'],
        ...(options.worldNoThumbnail ? {} : { thumbnail_hash: 'thumb-grey' }),
      },
    },
    { match: '/world/fixture-two.dcl.eth/scenes', body: { scenes: [], total: 0 } },
    {
      match: '/world/fixture-team.dcl.eth/scenes',
      body: {
        scenes: [
          { entityId: 'w4', parcels: ['0,0'], entity: { metadata: { scene: { base: '0,0' } } } },
        ],
        total: 1,
      },
    },
    {
      match: '/world/fixture-stream.dcl.eth/scenes',
      body: {
        scenes: [
          {
            entityId: 'w3',
            parcels: ['0,0'],
            entity: { metadata: { display: { title: 'Stream Stage' }, scene: { base: '0,0' } } },
          },
        ],
        total: 1,
      },
    },
    { match: '/world/fixture-stream.dcl.eth/settings', body: {} },
    {
      match: 'worlds-content-server.decentraland.org/worlds?',
      ...(options.worldsFail
        ? { status: 500 }
        : { body: { worlds: published, total: published.length } }),
    },
    { match: '/content/entities/active', body: activeEntities(lands, []) },
  ];
}

function ethCallAnswers(names: ManageFixtureOptions['names']) {
  const word = (value: string) => `0x${value.replace(/^0x/, '').padStart(64, '0')}`;
  const zero = word('');
  const answers: Record<string, string> = {
    [`${toFunctionSelector('getTokenId(string)')}:*`]: word('1'),
  };
  for (const label of ['fixtureone', 'fixturethree']) {
    const node = namehash(`${label}.dcl.eth`);
    const linked = names === 'set' && label === 'fixturethree';
    answers[`${toFunctionSelector('resolver(bytes32)')}:${node}`] = linked
      ? word(FIXTURE_ACCOUNTS.cal)
      : zero;
    answers[`${toFunctionSelector('owner(bytes32)')}:${node}`] = word(MOCK_ADDRESS);
    answers[`${toFunctionSelector('addr(bytes32)')}:${node}`] = zero;
    answers[`${toFunctionSelector('contenthash(bytes32)')}:${node}`] = encodeAbiParameters(
      [{ type: 'bytes' }],
      [linked ? NAME_CONTENT : '0x'],
    );
  }
  return answers;
}

/** Serves every Manage and LAND detail source from fixtures; thumbnails go through routing. */
export async function installManageFixtures(
  context: BrowserContext,
  options: ManageFixtureOptions,
): Promise<void> {
  const answers = stubAnswers(options);
  const entities = activeEntities(options.lands ?? [], [
    '96,15',
    '-3,7',
    ...ESTATE_PARCELS.map(([x, y]) => `${x},${y}`),
  ]);
  const ownerOf = toFunctionSelector('ownerOf(uint256)');
  const nameOwner = `${ownerOf}:0x${BigInt(keccak256(toBytes('fixtureben')))
    .toString(16)
    .padStart(64, '0')}`;
  const dynamic = {
    ownerOf,
    nameOwner,
    ben: FIXTURE_ACCOUNTS.ben,
    ethCalls: ethCallAnswers(options.names),
    profiles: PROFILE_NAMES,
    face: 'thumb-grey',
    self: MOCK_ADDRESS,
    relay: options.relay ?? { outcome: 'sign' },
    receipt: options.receipt ?? { status: 'success' },
    deployers: {
      p1: FIXTURE_ACCOUNTS.ben,
      p3a: FIXTURE_ACCOUNTS.ana,
      p3b: '0x00000000000000000000000000000000000000e5',
    } as Record<string, string>,
  };
  await context.addInitScript(
    ({ answers, entities, dynamic }) => {
      const w = window as any;
      const txTo: Record<string, string> = {};
      const firstPoll: Record<string, number> = {};
      const startedAt = Math.floor(Date.now() / 1000);
      const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      w.open = () => null;

      const rpc = (call: { id: number; method: string; params?: any[] }) => {
        const result = (() => {
          if (call.method === 'eth_chainId') return '0x1';
          if (call.method === 'eth_blockNumber') {
            return `0x${(16 + Math.floor(Date.now() / 1000) - startedAt).toString(16)}`;
          }
          if (call.method === 'eth_call') {
            const data: string = call.params?.[0]?.data ?? '';
            const selector = data.slice(0, 10);
            if (selector === dynamic.ownerOf) {
              return `${selector}:0x${data.slice(10, 74)}` === dynamic.nameOwner
                ? `0x${dynamic.ben.slice(2).padStart(64, '0')}`
                : { revert: true };
            }
            return (
              dynamic.ethCalls[`${selector}:0x${data.slice(10, 74)}`] ??
              dynamic.ethCalls[`${selector}:*`] ??
              `0x${'0'.repeat(64)}`
            );
          }
          if (call.method === 'eth_getBlockByNumber') {
            const number = `0x${(16 + Math.floor(Date.now() / 1000) - startedAt).toString(16)}`;
            return {
              number,
              hash: `0x${'4'.repeat(64)}`,
              parentHash: `0x${'5'.repeat(64)}`,
              timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
              nonce: '0x0000000000000000',
              difficulty: '0x0',
              gasLimit: '0x1c9c380',
              gasUsed: '0x0',
              miner: `0x${'0'.repeat(40)}`,
              extraData: '0x',
              logsBloom: `0x${'0'.repeat(512)}`,
              transactionsRoot: `0x${'6'.repeat(64)}`,
              stateRoot: `0x${'7'.repeat(64)}`,
              receiptsRoot: `0x${'8'.repeat(64)}`,
              sha3Uncles: `0x${'9'.repeat(64)}`,
              size: '0x1',
              baseFeePerGas: '0x1',
              transactions: [],
              uncles: [],
            };
          }
          if (call.method === 'eth_getTransactionByHash') {
            const hash = call.params?.[0];
            return {
              hash,
              from: dynamic.self,
              to: txTo[hash] ?? null,
              input: '0x',
              nonce: '0x1',
              gas: '0x5208',
              gasPrice: '0x1',
              value: '0x0',
              type: '0x0',
              chainId: '0x1',
              v: '0x25',
              r: `0x${'2'.repeat(64)}`,
              s: `0x${'3'.repeat(64)}`,
              blockHash: null,
              blockNumber: null,
              transactionIndex: null,
            };
          }
          if (call.method === 'eth_getTransactionReceipt') {
            const hash = call.params?.[0];
            firstPoll[hash] ??= Date.now();
            const ready = Date.now() - firstPoll[hash] >= (dynamic.receipt.delayMs ?? 0);
            if (dynamic.receipt.status === 'none' || !ready) return null;
            return {
              transactionHash: hash,
              blockHash: `0x${'1'.repeat(64)}`,
              blockNumber: `0x${(16 + Math.floor(Date.now() / 1000) - startedAt).toString(16)}`,
              transactionIndex: '0x0',
              from: dynamic.self,
              to: txTo[hash] ?? null,
              status: dynamic.receipt.status === 'success' ? '0x1' : '0x0',
              cumulativeGasUsed: '0x1',
              gasUsed: '0x1',
              effectiveGasPrice: '0x1',
              logs: [],
              logsBloom: `0x${'0'.repeat(512)}`,
              type: '0x2',
              contractAddress: null,
            };
          }
          return null;
        })();
        if (result && typeof result === 'object' && 'revert' in result) {
          return {
            jsonrpc: '2.0',
            id: call.id,
            error: { code: 3, message: 'execution reverted', data: '0x' },
          };
        }
        return { jsonrpc: '2.0', id: call.id, result };
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = typeof init?.body === 'string' ? init.body : '';
        if (url.includes('rpc.decentraland.org')) {
          const request = JSON.parse(body);
          return json(Array.isArray(request) ? request.map(rpc) : rpc(request));
        }
        const profile = url.match(/\/lambdas\/profiles\/(0x[0-9a-fA-F]+)/);
        if (profile) {
          const name = dynamic.profiles[profile[1].toLowerCase()];
          if (!name) return json({ avatars: [] }, 404);
          return json({
            avatars: [
              { name, ethAddress: profile[1], avatar: { snapshots: { face256: dynamic.face } } },
            ],
          });
        }
        if (url.includes('/content/deployments?')) {
          const asked = new URL(url).searchParams.getAll('entityId');
          return json({
            deployments: asked
              .filter(entityId => dynamic.deployers[entityId])
              .map(entityId => ({ entityId, deployedBy: dynamic.deployers[entityId] })),
            pagination: { offset: 0, limit: 500, moreData: false },
          });
        }
        const answer = answers.find(a => url.includes(a.match) || body.includes(a.match));
        if (!answer) return realFetch(input, init);
        if (answer.delayMs) await sleep(answer.delayMs);
        if (answer.status) return new Response('fixture failure', { status: answer.status });
        if (url.includes('land-manager') && w.__fixtureTransferred) {
          const data = JSON.parse(JSON.stringify(answer.body));
          data.data.ownerParcels = data.data.ownerParcels.filter(
            (item: { x: string }) => item.x !== '96',
          );
          return json(data);
        }
        const payload = url.includes('/content/entities/active')
          ? entities.filter(entity =>
              entity.pointers.some(pointer => (JSON.parse(body).pointers ?? []).includes(pointer)),
            )
          : answer.body;
        return json(payload);
      };

      type Socket = { queue: string[]; waiting: any };
      const relay = { sockets: new Map<string, Socket>(), count: 0, opened: 0 };
      const respond = (xhr: any, text: string) => {
        xhr.readyState = 4;
        xhr.status = 200;
        xhr.responseText = text;
        xhr.response = text;
        setTimeout(() => {
          xhr.onreadystatechange?.();
          xhr.onload?.();
        });
      };
      const flush = (socket: Socket) => {
        if (!socket.waiting || !socket.queue.length) return;
        const xhr = socket.waiting;
        socket.waiting = null;
        respond(xhr, socket.queue.splice(0).join('\x1e'));
      };
      const sidOf = (url: string) => new URL(url, 'http://fixture').searchParams.get('sid') ?? '';
      const onClientPacket = (socket: Socket, packet: string) => {
        const push = (out: string) => {
          socket.queue.push(out);
          flush(socket);
        };
        if (packet === '40') push('40{"sid":"fixture-socket"}');
        const event = packet.match(/^42(\d+)(\[.*)$/);
        if (!event) return;
        const [name, request] = JSON.parse(event[2]);
        if (name !== 'request') return;
        const requestId = `fixture-request-${++relay.count}`;
        const delay = dynamic.relay.delayMs ?? 0;
        const outcomes = ([] as string[]).concat(dynamic.relay.outcome);
        const outcome = outcomes[Math.min(relay.count - 1, outcomes.length - 1)];
        const expiration = new Date(
          Date.now() + (outcome === 'expire' ? delay : 600_000),
        ).toISOString();
        push(`43${event[1]}${JSON.stringify([{ requestId, expiration, code: relay.count }])}`);
        const hash = `0x${relay.count.toString(16).padStart(64, '0')}`;
        txTo[hash] = request.params?.[0]?.to;
        if (outcome === 'expire') return;
        setTimeout(() => {
          const transfer = String(request.params?.[0]?.data ?? '').startsWith('0x23b872dd');
          if (outcome === 'sign' && transfer) w.__fixtureTransferred = true;
          push(
            `42${JSON.stringify([
              'outcome',
              outcome === 'sign'
                ? { requestId, sender: dynamic.self, result: hash }
                : { requestId, error: { code: -32003, message: 'rejected' } },
            ])}`,
          );
        }, delay);
      };

      const RealXHR = window.XMLHttpRequest;
      class FixtureXHR {
        readyState = 0;
        status = 0;
        responseText = '';
        response = '';
        responseType = '';
        withCredentials = false;
        timeout = 0;
        onreadystatechange: (() => void) | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private real: XMLHttpRequest | null = null;
        private method = 'GET';
        private url = '';
        open(method: string, url: string, ...rest: any[]) {
          this.method = method;
          this.url = url;
          if (!url.includes('/socket.io/')) {
            this.real = new RealXHR();
            (this.real.open as any)(method, url, ...rest);
          }
        }
        setRequestHeader(name: string, value: string) {
          this.real?.setRequestHeader(name, value);
        }
        getAllResponseHeaders() {
          return this.real?.getAllResponseHeaders() ?? '';
        }
        getResponseHeader(name: string) {
          return this.real?.getResponseHeader(name) ?? null;
        }
        abort() {
          this.real?.abort();
        }
        addEventListener() {}
        removeEventListener() {}
        send(body?: string) {
          const real = this.real;
          if (real) {
            real.withCredentials = this.withCredentials;
            real.onreadystatechange = () => {
              this.readyState = real.readyState;
              this.status = real.status;
              this.responseText = real.responseText;
              this.response = real.response;
              this.onreadystatechange?.();
            };
            real.onload = () => this.onload?.();
            real.onerror = () => this.onerror?.();
            real.send(body);
            return;
          }
          const sid = sidOf(this.url);
          if (this.method === 'GET' && !sid) {
            const opened = `fixture-${++relay.opened}`;
            relay.sockets.set(opened, { queue: [], waiting: null });
            respond(
              this,
              `0{"sid":"${opened}","upgrades":[],"pingInterval":600000,"pingTimeout":600000,"maxPayload":1000000}`,
            );
            return;
          }
          const socket = relay.sockets.get(sid);
          if (!socket) return respond(this, '1');
          if (this.method === 'GET') {
            socket.waiting = this;
            flush(socket);
            return;
          }
          respond(this, 'ok');
          for (const packet of (body ?? '').split('\x1e')) onClientPacket(socket, packet);
        }
      }
      w.XMLHttpRequest = FixtureXHR;
    },
    { answers, entities, dynamic },
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

/** Replaces the save dialog and the scene export in the main process with fakes that touch no disk or network. */
export async function stubDesktopActions(
  app: ElectronApplication,
  options: { recovered: 'none' | 'self-contained' | 'partial'; stepMs: number; steps: number },
): Promise<void> {
  await app.evaluate(({ ipcMain }, { recovered, stepMs, steps }) => {
    const cancelled = new Set<string>();
    const ok = (value: unknown) => ({ success: true, value });
    for (const channel of ['electron.showSaveDialog', 'sceneExport.export', 'sceneExport.cancel']) {
      ipcMain.removeHandler(channel);
    }
    ipcMain.handle('electron.showSaveDialog', () => ok('/tmp/fixture-scene.zip'));
    ipcMain.handle('sceneExport.cancel', (_event, entityId: string) => {
      cancelled.add(entityId);
      return ok(undefined);
    });
    ipcMain.handle('sceneExport.export', async (event, { entityId }: { entityId: string }) => {
      for (let done = 1; done <= steps; done++) {
        await new Promise(resolve => setTimeout(resolve, stepMs));
        if (cancelled.delete(entityId)) {
          return { success: false, error: { name: 'AbortError', message: 'aborted' } };
        }
        event.sender.send('sceneExport.progress', {
          entityId,
          phase: 'download',
          done,
          total: steps,
        });
      }
      return ok({ files: steps, bytes: steps, recoveredSources: 0, recovered, skipped: [] });
    });
  }, options);
}

/** How the catalyst answers the main process's unpublish deploy, after `delayMs`. */
export type CatalystDeployFixture = { outcome: 'ok' | 'fail'; delayMs?: number };

/**
 * Answers the main process's catalyst deploys with a fake, so an unpublish reaches no network.
 * Each deploy's URL, entity id and multipart check is recorded on `globalThis.__fixtureDeploys` in main.
 */
export async function stubCatalystDeploy(
  app: ElectronApplication,
  fixture: CatalystDeployFixture,
): Promise<void> {
  await app.evaluate(({ net }, { outcome, delayMs }) => {
    const realFetch = net.fetch.bind(net);
    const deploys: Array<{ url: string; entityId: string | null; multipart: boolean }> = [];
    (globalThis as any).__fixtureDeploys = deploys;
    net.fetch = (async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/content/available-content')) return new Response('[]');
      if (!/\/content\/entities$/.test(url) || (init?.method ?? 'GET').toUpperCase() !== 'POST') {
        return realFetch(input, init);
      }
      const body = new TextDecoder().decode(init?.body as Uint8Array);
      const boundary = new Headers(init?.headers).get('content-type')?.match(/boundary=(.+)$/)?.[1];
      deploys.push({
        url,
        entityId: body.match(/name="entityId"\r\n\r\n([a-z0-9]+)/)?.[1] ?? null,
        multipart: !!boundary && body.includes(`--${boundary}`),
      });
      await new Promise(resolve => setTimeout(resolve, delayMs ?? 0));
      return outcome === 'ok'
        ? new Response(JSON.stringify({ creationTimestamp: Date.now() }), {
            headers: { 'content-type': 'application/json' },
          })
        : new Response('fixture failure', { status: 500 });
    }) as typeof net.fetch;
  }, fixture);
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
