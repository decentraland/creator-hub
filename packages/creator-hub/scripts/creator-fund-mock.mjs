import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const ROOT = '/v3/creator-fund';
const BASE_TERMS_VERSION = 1;
const MAX_ENROLLMENT_BODY_BYTES = 4096;
const WALLET_REASONS = ['internal', 'suspended', 'excluded'];
const ENROLLMENT_STATES = ['active', 'suspended'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OWNER = '0x00000000000000000000000000000000000000aa';
const WALLET_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const FIXTURE_WALLET = '0x000000000000000000000000000000000000dEaD';
const TEST_CODE = '000000';
const MAX_CODE_ATTEMPTS = 5;
const RESEND_MS = 60_000;
const CODE_TTL_MS = 600_000;

const ALL_CYCLES = [
  [6, '2026-11-16', '2026-12-01', 'upcoming', null],
  [5, '2026-11-01', '2026-11-16', 'running', 12000],
  [4, '2026-10-16', '2026-11-01', 'closed', 10000],
  [3, '2026-10-01', '2026-10-16', 'closed', 10000],
  [2, '2026-09-16', '2026-10-01', 'closed', 8000],
  [1, '2026-09-01', '2026-09-16', 'closed', 8000],
].map(([id, start, end, status, pool]) => ({
  id,
  start_at: `${start}T00:00:00Z`,
  end_at: `${end}T00:00:00Z`,
  pool_usdc: pool,
  status,
}));

const TITLES = [
  'Neon Art Gallery',
  'Pixel Plaza',
  'Moonlit Maze',
  'Cactus Karaoke',
  'Floating Library',
  'Retro Arcade Hall',
  'Lantern Garden',
  'Sky Ferris Park',
  'Bubble Tea Corner',
  'Crystal Caverns',
  'Robot Repair Shop',
  'Tidepool Lounge',
  'Hexagon Hideout',
  'Velvet Jazz Club',
  'Orbit Skatepark',
  'Paper Kite Hill',
  'Glitch Museum',
  'Sunflower Racetrack',
  'Marble Run Tower',
  'Frosty Fun Fair',
  'Copper Clocktower',
  'Mushroom Market',
  'Echo Amphitheater',
  'Tiny Toy Town',
  'Dune Buggy Rally',
  'Coral Reef Dome',
];

function thumbnail(index) {
  const hue = (index * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="hsl(${hue},60%,45%)"/><text x="160" y="98" font-family="sans-serif" font-size="28" fill="white" text-anchor="middle">${index + 1}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const MULTI_SCENE_PLACE = 3;
const MULTI_SCENE_WORLD_SCENES = 3;

function place(index, overrides = {}) {
  const isWorld = index % 3 === 0;
  const slug = TITLES[index].toLowerCase().replace(/[^a-z]+/g, '-');
  const inMultiSceneWorld = index === MULTI_SCENE_PLACE;
  const x = inMultiSceneWorld ? 2 : isWorld ? 0 : (index % 30) - 15;
  const y = inMultiSceneWorld ? 1 : isWorld ? 0 : ((index * 7) % 30) - 15;
  return {
    id: `place-${index + 1}`,
    title: TITLES[index],
    image: index % 7 === 6 ? null : thumbnail(index),
    world: isWorld,
    world_name: isWorld ? `example-${slug}.dcl.eth` : null,
    base_position: `${x},${y}`,
    positions: [`${x},${y}`],
    owner: OWNER,
    role: 'owner',
    status: 'in_program',
    reasons: [],
    ...overrides,
  };
}

const MY_PLACES = [
  ...Array.from({ length: 8 }, (_, index) => place(index)),
  place(8, { status: 'replaced' }),
  place(9, { status: 'not_eligible', reasons: ['content_policy'] }),
  place(10, { status: 'not_eligible', reasons: ['excluded'] }),
  place(11),
  place(12, {
    status: 'not_eligible',
    reasons: ['not_owner'],
    role: 'collaborator',
    owner: '0x00000000000000000000000000000000000000bb',
  }),
  place(13),
];

const WORLD_SCENE_COUNTS = new Map(
  TITLES.map((_, index) => place(index))
    .filter(entry => entry.world)
    .map(entry => [
      entry.world_name,
      entry.world_name === place(MULTI_SCENE_PLACE).world_name ? MULTI_SCENE_WORLD_SCENES : 1,
    ]),
);

const micro = amount => Math.round(Number(amount) * 1e6);
const usdc = amount => (amount / 1e6).toFixed(6).replace(/0{1,4}$/, '');

const PAYOUTS = [
  [4, 'pending', [0, 3, 5], ['9.00', '8.50', '5.125']],
  [3, 'paid', [1, 3], ['14.00', '6.00']],
  [2, 'paid', [3, 4, 7, 2], ['11.00', '7.25', '3.00', '2.00']],
].map(([cycleId, status, placeIndexes, amounts]) => {
  const cycle = ALL_CYCLES.find(candidate => candidate.id === cycleId);
  const paid = status === 'paid';
  return {
    cycle: { id: cycle.id, start_at: cycle.start_at, end_at: cycle.end_at, status: cycle.status },
    status,
    paid_places: placeIndexes.length,
    amount_usdc: usdc(amounts.reduce((total, amount) => total + micro(amount), 0)),
    transaction_hash: paid ? `0x${String(cycleId).padStart(64, '0')}` : null,
    paid_at: paid ? cycle.end_at.replace('T00', 'T12') : null,
    places: placeIndexes.map((placeIndex, index) => {
      const { id, title, image, world, world_name, base_position } = place(placeIndex);
      return {
        place: { id, title, image, world, world_name, base_position },
        amount_usdc: amounts[index],
      };
    }),
  };
});

const WORLD_SCENES_PATH = /^\/world\/([^/]+)\/scenes$/;

const cents = (cycleIndex, placeIndex) =>
  ((placeIndex * 7919 + cycleIndex * 104729) % 180000) + 1500;

function rankEntries(totals) {
  const top = [...totals].sort((a, b) => b.cents - a.cents).slice(0, 20);
  let rank = 0;
  return top.map((entry, index) => {
    if (index === 0 || entry.cents !== top[index - 1].cents) rank = index + 1;
    return { rank, place: place(entry.placeIndex), earned_usdc: (entry.cents / 100).toFixed(2) };
  });
}

function cycleTotals(cycleIndex) {
  const totals = TITLES.map((_, placeIndex) => placeIndex)
    .filter(placeIndex => (placeIndex + cycleIndex) % 5 !== 0)
    .map(placeIndex => ({ placeIndex, cents: cents(cycleIndex, placeIndex) }))
    .sort((a, b) => b.cents - a.cents);
  totals[2].cents = totals[1].cents;
  return totals;
}

const NEWS = [
  [
    46,
    '2026-11-03',
    'Cycle Nov 1 – Nov 15 is live',
    'Every eligible place earns from its first visit this cycle. Check My Places for your standing.',
  ],
  [
    45,
    '2026-11-02',
    'Payouts for Oct 16 – Oct 31 are out',
    '85 creators were paid this cycle. Payouts reach the wallet you sign in with.',
  ],
  [
    44,
    '2026-10-24',
    'Retention now counts toward rank',
    'Day-3 retention joins attributable new players in the ranking formula.',
  ],
  [43, '2026-10-17', 'Payouts for Oct 1 – Oct 15 are out', '62 creators were paid this cycle.'],
  [
    42,
    '2026-10-10',
    'Worlds are eligible',
    'Places in Worlds count, as long as they are not password, invite or NFT gated.',
  ],
  [
    41,
    '2026-10-01',
    'The Creator Fund beta opens',
    'Join from the EARN tab to start earning from the players your places bring in.',
  ],
].map(([id, date, title, body]) => ({ id, title, body, published_at: `${date}T00:00:00Z` }));

const BANNER = {
  markdown:
    '**Cycle Nov 1 – Nov 15** closes in *12 days*. [Read the program rules](https://example.com/creator-fund-rules).',
};

function terms(version) {
  const sections = [
    'About the Program',
    'Eligibility',
    'Enrollment',
    'Reward Cycles',
    'Payouts',
    'Wallets',
    'Conduct',
    'Changes to These Terms',
  ].map(
    (heading, index) =>
      `## ${index + 1}. ${heading}\n\nPlaceholder text for section ${index + 1} of version ${version}, for local development only.\n\nIt describes no real program and grants no rights. It is long enough to make the terms box scroll, so the accept gate can be exercised.\n\n- A placeholder point\n- Another placeholder point`,
  );
  return {
    version,
    title: 'Example Creator Fund Program Terms (Beta)',
    published_at: version === BASE_TERMS_VERSION ? '2026-10-22T00:00:00Z' : '2026-11-03T00:00:00Z',
    content: `${sections.join('\n\n')}\n\nSee [the example rules](https://example.com/creator-fund-rules).`,
  };
}

function metricsFor(location, index) {
  const seed = (Math.abs(location.x) + Math.abs(location.y) + index) % 7;
  const rows = value => [{ series: 'all', period: null, value }];
  const metrics = {};
  if (seed !== 3) metrics.new_decentraland_players_30d = rows(120 + seed * 137);
  if (seed !== 5) metrics.d3_retention_rate_30d = rows(Number((0.04 + seed * 0.021).toFixed(3)));
  if (seed !== 1) metrics.avg_playtime_seconds_30d = rows(600 + seed * 1800);
  return {
    location_key: location.world
      ? `${location.world}|${location.x},${location.y}`
      : `${location.x},${location.y}`,
    builder_project_id: null,
    ...location,
    metrics,
  };
}

class HttpError extends Error {
  constructor(status, error, message, extra = {}) {
    super(message ?? error);
    this.status = status;
    this.body = { error, ...(message === undefined ? {} : { message }), ...extra };
  }
}

function signerOf(req) {
  let address;
  try {
    address = JSON.parse(req.headers['x-identity-auth-chain-0']).payload;
  } catch {
    address = null;
  }
  if (typeof address !== 'string' || !address) {
    throw new HttpError(401, 'Unauthorized', 'Missing or invalid signature');
  }
  return address.toLowerCase();
}

async function readText(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'Bad Request', 'body is not valid JSON');
  }
}

const readJson = async req => parseJson(await readText(req));

function assertBodyBound(req, raw) {
  let declared;
  try {
    declared = JSON.parse(req.headers['x-identity-metadata'] ?? '{}').hashPayload;
  } catch {
    declared = undefined;
  }
  if (typeof declared !== 'string') {
    throw new HttpError(401, 'Unauthorized', 'the signed metadata carries no "hashPayload"');
  }
  const actual = createHash('sha256').update(raw, 'utf8').digest('hex');
  if (declared.toLowerCase() !== actual) {
    throw new HttpError(401, 'Unauthorized', '"hashPayload" does not match the body');
  }
}

function cycleIdOf(query) {
  const raw = query.get('cycle');
  if (raw === null) return undefined;
  const id = Number(raw);
  if (!Number.isInteger(id))
    throw new HttpError(400, 'Bad Request', '"cycle" must be an integer id');
  return id;
}

function invalidContact(body) {
  for (const name of ['first_name', 'last_name']) {
    const value = typeof body[name] === 'string' ? body[name].trim() : '';
    if (value.length < 1 || value.length > 100) return `${name} must be 1 to 100 characters`;
  }
  if (typeof body.email !== 'string' || body.email.length > 254 || !EMAIL.test(body.email)) {
    return 'email must be a valid address of at most 254 characters';
  }
  return null;
}

/**
 * The Creator Fund API mock: creators-data's `/v3/creator-fund/*` (plus the mock-only leaderboard
 * and banner) and `POST /v2/metrics`, in memory per signer. The auth chain is read, never verified;
 * a `PUT` body is checked against the signed `hashPayload`, as the service does. `PUT /enrollment`
 * refuses in the service's order: a stale `terms_version` (400), a suspended enrollment (409), then
 * an ineligible wallet (403, never for `suspended`). Cycles are listed oldest first. A place's status
 * follows the service's rule: `eligible` before joining, `in_program` after, and `not_eligible` with
 * stacked `creator_not_eligible` / `terms_outdated` reasons. A closed cycle lists the signer's owner
 * places only when it ended after the join. The leaderboard echoes `cycle_id` as the raw query value.
 * @param {object} options
 * @param {string} [options.ineligible] - a `WalletReason` every signer fails with.
 * @param {number} [options.termsVersion] - the current terms version once anyone joins.
 * @param {string} [options.enrollment] - `active` or `suspended`: every signer is enrolled so.
 * @param {boolean} [options.noClosedCycle] - list no closed cycle.
 * @param {boolean} [options.noRunning] - list only the upcoming cycle: nothing running or closed.
 * @param {boolean} [options.payoutWallet] - every signer starts with a payout wallet.
 * @param {boolean} [options.emailVerified] - every enrollment starts with its email verified.
 * @param {boolean} [options.noPayouts] - serve no payouts (the empty state).
 * @param {number} [options.resendMs] - how long a sent code holds off a resend.
 * @param {number} [options.codeTtlMs] - how long a sent code is valid.
 * @param {() => number} [options.clock] - the mock's time, in ms; a test's fake clock.
 * @param {[number, number]} [options.latency] - min and max response delay, in ms.
 */
export function createMockServer({
  ineligible,
  termsVersion,
  enrollment,
  noClosedCycle = false,
  noRunning = false,
  payoutWallet = false,
  emailVerified = false,
  noPayouts = false,
  resendMs = RESEND_MS,
  codeTtlMs = CODE_TTL_MS,
  clock = Date.now,
  latency = [300, 800],
} = {}) {
  if (ineligible && !WALLET_REASONS.includes(ineligible)) {
    throw new Error(`MOCK_INELIGIBLE must be one of ${WALLET_REASONS.join(', ')}`);
  }
  if (enrollment && !ENROLLMENT_STATES.includes(enrollment)) {
    throw new Error(`MOCK_ENROLLMENT must be one of ${ENROLLMENT_STATES.join(', ')}`);
  }
  const cycles = noRunning
    ? ALL_CYCLES.filter(cycle => cycle.status === 'upcoming')
    : noClosedCycle
      ? ALL_CYCLES.filter(cycle => cycle.status !== 'closed')
      : ALL_CYCLES;
  const closed = cycles.filter(cycle => cycle.status === 'closed');
  const enrollments = new Map();
  const wallets = new Map();
  const verifications = new Map();
  const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const verifiedAt = () => (emailVerified ? '2026-10-20T10:05:00Z' : null);
  let currentTermsVersion = BASE_TERMS_VERSION;

  const enrollmentOf = signer =>
    enrollments.get(signer) ??
    (enrollment
      ? {
          status: enrollment,
          enrolled_at: '2026-10-20T10:00:00Z',
          terms_version: BASE_TERMS_VERSION,
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane.doe@example.com',
          email_verified_at: verifiedAt(),
        }
      : null);

  const walletOf = signer =>
    wallets.get(signer) ??
    (payoutWallet ? { address: FIXTURE_WALLET, updated_at: '2026-10-21T09:00:00Z' } : null);

  const joinedEnrollmentOf = signer => {
    const found = enrollmentOf(signer);
    if (!found) throw new HttpError(404, 'Not Found', 'not enrolled');
    return found;
  };

  const readBoundBody = async req => {
    const raw = await readText(req);
    if (Buffer.byteLength(raw, 'utf8') > MAX_ENROLLMENT_BODY_BYTES) {
      throw new HttpError(
        413,
        'Payload Too Large',
        `body must be at most ${MAX_ENROLLMENT_BODY_BYTES} bytes`,
      );
    }
    assertBodyBound(req, raw);
    return parseJson(raw);
  };

  const withStatus = (entry, joined) => {
    if (entry.role === 'collaborator' || entry.status === 'replaced') return entry;
    const reasons = [...entry.reasons];
    if (ineligible) reasons.push('creator_not_eligible');
    if (joined && joined.terms_version !== currentTermsVersion) reasons.push('terms_outdated');
    if (reasons.length > 0) return { ...entry, status: 'not_eligible', reasons };
    return { ...entry, status: joined ? 'in_program' : 'eligible' };
  };

  const placesFor = (signer, cycle) => {
    const joined = enrollmentOf(signer);
    if (cycle.status !== 'closed') return MY_PLACES.map(entry => withStatus(entry, joined));
    if (!joined || Date.parse(joined.enrolled_at) >= Date.parse(cycle.end_at)) return [];
    return MY_PLACES.filter(entry => entry.role === 'owner').map(entry =>
      withStatus(entry, joined),
    );
  };

  const defaultCycle = () =>
    cycles.find(cycle => cycle.status === 'running') ??
    cycles.filter(cycle => cycle.status === 'upcoming').at(-1) ??
    closed[0];

  const routes = {
    [`GET ${ROOT}/cycles`]: () => [200, { cycles: [...cycles].reverse() }],
    [`GET ${ROOT}/terms`]: () => [200, terms(currentTermsVersion)],
    [`GET ${ROOT}/news`]: () => [200, { news: NEWS }],
    [`GET ${ROOT}/banner`]: () => [200, BANNER],
    [`GET ${ROOT}/eligibility`]: () => [
      200,
      ineligible ? { eligible: false, reasons: [ineligible] } : { eligible: true, reasons: [] },
    ],
    [`GET ${ROOT}/enrollment`]: ({ signer }) => {
      const found = enrollmentOf(signer);
      if (!found) throw new HttpError(404, 'Not Found', 'not enrolled');
      return [200, found];
    },
    [`PUT ${ROOT}/enrollment`]: async ({ signer, req }) => {
      const raw = await readText(req);
      if (Buffer.byteLength(raw, 'utf8') > MAX_ENROLLMENT_BODY_BYTES) {
        throw new HttpError(
          413,
          'Payload Too Large',
          `body must be at most ${MAX_ENROLLMENT_BODY_BYTES} bytes`,
        );
      }
      assertBodyBound(req, raw);
      const body = parseJson(raw);
      const invalid = invalidContact(body);
      if (invalid) throw new HttpError(400, 'Bad Request', invalid);
      if (typeof body.terms_version !== 'number' || !Number.isInteger(body.terms_version)) {
        throw new HttpError(400, 'Bad Request', '"terms_version" must be an integer');
      }
      if (body.terms_version !== currentTermsVersion) {
        throw new HttpError(400, 'Bad Request', `terms_version must be ${currentTermsVersion}`);
      }
      const existing = enrollmentOf(signer);
      if ((existing && existing.status !== 'active') || ineligible === 'suspended') {
        throw new HttpError(
          409,
          'Conflict',
          `the enrollment is ${existing?.status ?? 'suspended'}`,
        );
      }
      if (ineligible) throw new HttpError(403, 'Forbidden', undefined, { reasons: [ineligible] });
      const saved = {
        status: 'active',
        enrolled_at: existing?.enrolled_at ?? iso(clock()),
        terms_version: body.terms_version,
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        email: body.email,
        email_verified_at:
          existing && existing.email === body.email ? existing.email_verified_at : verifiedAt(),
      };
      enrollments.set(signer, saved);
      if (!existing && termsVersion) currentTermsVersion = termsVersion;
      return [existing ? 200 : 201, saved];
    },
    [`GET ${ROOT}/places`]: ({ signer, query }) => {
      const id = cycleIdOf(query);
      if (id === undefined) {
        const cycle = defaultCycle() ?? null;
        return [200, { cycle, places: cycle ? placesFor(signer, cycle) : [] }];
      }
      const cycle = cycles.find(candidate => candidate.id === id);
      if (!cycle) throw new HttpError(404, 'Not Found', `no cycle has id ${id}`);
      return [200, { cycle, places: placesFor(signer, cycle) }];
    },
    [`GET ${ROOT}/payouts`]: () => [200, { payouts: noPayouts ? [] : PAYOUTS }],
    [`GET ${ROOT}/payout-wallet`]: ({ signer }) => {
      const found = walletOf(signer);
      if (!found) throw new HttpError(404, 'Not Found', 'no payout wallet');
      return [200, found];
    },
    [`PUT ${ROOT}/payout-wallet`]: async ({ signer, req }) => {
      const body = await readBoundBody(req);
      if (typeof body.address !== 'string' || !WALLET_ADDRESS.test(body.address)) {
        throw new HttpError(400, 'invalid_address', 'address must be 0x and 40 hex characters');
      }
      if (enrollmentOf(signer)?.status === 'suspended') {
        throw new HttpError(409, 'Conflict', 'the enrollment is suspended');
      }
      const existing = walletOf(signer);
      const saved = { address: body.address, updated_at: iso(clock()) };
      wallets.set(signer, saved);
      return [existing ? 200 : 201, saved];
    },
    [`POST ${ROOT}/enrollment/email-verification`]: ({ signer }) => {
      const found = joinedEnrollmentOf(signer);
      if (found.email_verified_at) throw new HttpError(409, 'Conflict', 'already verified');
      const now = clock();
      const previous = verifications.get(signer);
      if (previous && now < previous.resendAt) {
        throw new HttpError(429, 'too_soon', undefined, {
          resend_available_at: iso(previous.resendAt),
        });
      }
      const sent = { sentAt: now, resendAt: now + resendMs, expiresAt: now + codeTtlMs, tries: 0 };
      verifications.set(signer, sent);
      return [
        202,
        {
          sent_at: iso(sent.sentAt),
          expires_at: iso(sent.expiresAt),
          resend_available_at: iso(sent.resendAt),
        },
      ];
    },
    [`PUT ${ROOT}/enrollment/email-verification`]: async ({ signer, req }) => {
      const body = await readBoundBody(req);
      const found = joinedEnrollmentOf(signer);
      const pending = verifications.get(signer);
      if (!pending || clock() > pending.expiresAt) {
        throw new HttpError(410, 'code_expired', 'the code has expired');
      }
      if (pending.tries >= MAX_CODE_ATTEMPTS) {
        throw new HttpError(429, 'too_many_attempts', undefined, {
          retry_at: iso(pending.resendAt),
        });
      }
      if (body.code !== TEST_CODE) {
        pending.tries += 1;
        throw new HttpError(400, 'invalid_code', 'the code is not right');
      }
      const verified = { ...found, email_verified_at: iso(clock()) };
      enrollments.set(signer, verified);
      verifications.delete(signer);
      return [200, verified];
    },
    [`GET ${ROOT}/leaderboard`]: ({ query }) => {
      if (query.get('cycle') === 'all') {
        const sums = new Map();
        closed.forEach((_, cycleIndex) =>
          cycleTotals(cycleIndex).forEach(({ placeIndex, cents: value }) =>
            sums.set(placeIndex, (sums.get(placeIndex) ?? 0) + value),
          ),
        );
        const totals = [...sums].map(([placeIndex, value]) => ({ placeIndex, cents: value }));
        return [200, { cycle_id: 'all', entries: rankEntries(totals) }];
      }
      const id = cycleIdOf(query);
      const cycle = id === undefined ? closed[0] : cycles.find(candidate => candidate.id === id);
      if (!cycle) throw new HttpError(404, 'Not Found', `Unknown cycle: ${id ?? 'none closed'}`);
      if (cycle.status !== 'closed') {
        throw new HttpError(400, 'Bad Request', 'The leaderboard exists only for closed cycles');
      }
      return [
        200,
        {
          cycle_id: query.get('cycle'),
          entries: rankEntries(cycleTotals(closed.indexOf(cycle))),
        },
      ];
    },
    'POST /v2/metrics': async ({ req }) => {
      const body = await readJson(req);
      const locations = Array.isArray(body.locations) ? body.locations : [];
      return [
        200,
        {
          exported_at: '2026-11-03T15:24:00Z',
          source: 'creator-fund-mock',
          locations: locations.map(metricsFor),
        },
      ];
    },
  };

  const signedRoutes = new Set([
    `GET ${ROOT}/eligibility`,
    `GET ${ROOT}/enrollment`,
    `PUT ${ROOT}/enrollment`,
    `GET ${ROOT}/places`,
    `GET ${ROOT}/payouts`,
    `GET ${ROOT}/payout-wallet`,
    `PUT ${ROOT}/payout-wallet`,
    `POST ${ROOT}/enrollment/email-verification`,
    `PUT ${ROOT}/enrollment/email-verification`,
    'POST /v2/metrics',
  ]);

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const worldScenes = req.method === 'GET' && url.pathname.match(WORLD_SCENES_PATH);
    const route = worldScenes ? 'GET /world/:name/scenes' : `${req.method} ${url.pathname}`;
    const handler = worldScenes
      ? () => {
          const total = WORLD_SCENE_COUNTS.get(decodeURIComponent(worldScenes[1])) ?? 0;
          return [200, { scenes: [], total }];
        }
      : routes[route];
    let status;
    let body;
    try {
      if (!handler) throw new HttpError(404, 'Not Found', `No route for ${route}`);
      const signer = signedRoutes.has(route) ? signerOf(req) : null;
      [status, body] = await handler({ signer, req, query: url.searchParams });
    } catch (error) {
      if (!(error instanceof HttpError)) console.error(error);
      status = error instanceof HttpError ? error.status : 500;
      body =
        error instanceof HttpError
          ? error.body
          : { error: 'Internal Server Error', message: String(error) };
    }
    const [min, max] = latency;
    await new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
    if (body === undefined) {
      res.writeHead(status).end();
      return;
    }
    res
      .writeHead(status, {
        'content-type': 'application/json',
        ...(worldScenes ? { 'access-control-allow-origin': '*' } : {}),
      })
      .end(JSON.stringify(body));
  });
}

/**
 * The mock's port (`PORT`, default 8788) and `createMockServer` options from `MOCK_*` variables.
 * @param {NodeJS.ProcessEnv} env
 */
export const mockConfigFromEnv = env => ({
  port: Number(env.PORT ?? 8788),
  options: {
    ineligible: env.MOCK_INELIGIBLE,
    termsVersion: env.MOCK_TERMS_VERSION ? Number(env.MOCK_TERMS_VERSION) : undefined,
    enrollment: env.MOCK_ENROLLMENT,
    noClosedCycle: env.MOCK_NO_CLOSED_CYCLE === '1',
    noRunning: env.MOCK_NO_RUNNING === '1',
    payoutWallet: env.MOCK_PAYOUT_WALLET === '1',
    emailVerified: env.MOCK_EMAIL_VERIFIED === '1',
    noPayouts: env.MOCK_NO_PAYOUTS === '1',
    resendMs: env.MOCK_RESEND_S ? Number(env.MOCK_RESEND_S) * 1000 : undefined,
    codeTtlMs: env.MOCK_CODE_TTL_S ? Number(env.MOCK_CODE_TTL_S) * 1000 : undefined,
  },
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port, options } = mockConfigFromEnv(process.env);
  createMockServer(options).listen(port, () => {
    console.log(`Creator Fund mock on http://localhost:${port}${ROOT}`);
  });
}
