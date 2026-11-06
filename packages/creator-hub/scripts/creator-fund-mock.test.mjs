import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  createMockServer,
  mockConfigFromEnv,
} from '../main/src/modules/creator-fund-fixtures/server.mjs';

const SIGNER = '0x00000000000000000000000000000000000000aa';

const authHeaders = (address = SIGNER) => ({
  'x-identity-auth-chain-0': JSON.stringify({ type: 'SIGNER', payload: address, signature: '' }),
});

async function startMock(options) {
  const server = createMockServer({ latency: [0, 0], ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { signed = false, body, raw, address, hash = 'auto' } = {}) => {
    const payload = raw ?? (body ? JSON.stringify(body) : undefined);
    const hashPayload =
      hash === 'auto' && payload !== undefined
        ? createHash('sha256').update(payload, 'utf8').digest('hex')
        : hash;
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(signed ? authHeaders(address) : {}),
        ...(signed && payload !== undefined && hash !== null
          ? { 'x-identity-metadata': JSON.stringify({ hashPayload }) }
          : {}),
        ...(payload !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: payload,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  return { server, call };
}

const CONTACT = { first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@example.com' };

describe('mockConfigFromEnv', () => {
  it('defaults to port 8788 with every switch off', () => {
    assert.deepEqual(mockConfigFromEnv({}), {
      port: 8788,
      options: {
        ineligible: undefined,
        termsVersion: undefined,
        enrollment: undefined,
        noClosedCycle: false,
        noRunning: false,
        payoutWallet: false,
        emailVerified: false,
        noPayouts: false,
        resendMs: undefined,
        codeTtlMs: undefined,
      },
    });
  });

  it('reads the MOCK_* switches, in seconds for the code timings', () => {
    const { port, options } = mockConfigFromEnv({
      PORT: '9000',
      MOCK_TERMS_VERSION: '2',
      MOCK_ENROLLMENT: 'active',
      MOCK_NO_PAYOUTS: '1',
      MOCK_RESEND_S: '5',
      MOCK_CODE_TTL_S: '30',
    });
    assert.equal(port, 9000);
    assert.equal(options.termsVersion, 2);
    assert.equal(options.enrollment, 'active');
    assert.equal(options.noPayouts, true);
    assert.equal(options.resendMs, 5000);
    assert.equal(options.codeTtlMs, 30000);
  });
});

describe('creator fund mock', () => {
  describe('with the default switches', () => {
    let mock;
    before(async () => {
      mock = await startMock({});
    });
    after(() => mock.server.close());

    it('lists upcoming, running and closed cycles in snake_case', async () => {
      const { status, body } = await mock.call('GET', '/v3/creator-fund/cycles');
      assert.equal(status, 200);
      const statuses = body.cycles.map(cycle => cycle.status);
      assert.equal(statuses.filter(value => value === 'running').length, 1);
      assert.ok(statuses.includes('upcoming'));
      assert.ok(statuses.filter(value => value === 'closed').length >= 3);
      for (const cycle of body.cycles) {
        assert.deepEqual(Object.keys(cycle).sort(), [
          'end_at',
          'id',
          'pool_usdc',
          'start_at',
          'status',
        ]);
        assert.equal(typeof cycle.id, 'number');
        assert.ok(cycle.pool_usdc === null || typeof cycle.pool_usdc === 'number');
      }
      assert.ok(body.cycles.some(cycle => cycle.pool_usdc === null));
      const starts = body.cycles.map(cycle => cycle.start_at);
      assert.deepEqual(starts, [...starts].sort(), 'oldest first, as the service sends them');
      assert.ok(body.cycles.some(cycle => typeof cycle.pool_usdc === 'number'));
    });

    it('serves the current terms as long Markdown', async () => {
      const { body } = await mock.call('GET', '/v3/creator-fund/terms');
      assert.deepEqual(Object.keys(body).sort(), ['content', 'published_at', 'title', 'version']);
      assert.equal(typeof body.version, 'number');
      assert.match(body.content, /^## /m);
      assert.ok(body.content.length > 2000);
    });

    it('serves published news newest first', async () => {
      const { body } = await mock.call('GET', '/v3/creator-fund/news');
      assert.ok(body.news.length >= 4);
      assert.ok(body.news.every(item => typeof item.id === 'number'));
      const dates = body.news.map(item => item.published_at);
      assert.deepEqual(dates, [...dates].sort().reverse());
    });

    it('answers 401 to signed routes without a signature', async () => {
      for (const path of [
        '/v3/creator-fund/eligibility',
        '/v3/creator-fund/enrollment',
        '/v3/creator-fund/places',
      ]) {
        assert.equal((await mock.call('GET', path)).status, 401, path);
      }
      assert.equal(
        (await mock.call('PUT', '/v3/creator-fund/enrollment', { body: CONTACT })).status,
        401,
      );
    });

    it('walks a signer from not enrolled to enrolled and re-accepted', async () => {
      const address = '0x00000000000000000000000000000000000000b1';
      assert.equal(
        (await mock.call('GET', '/v3/creator-fund/enrollment', { signed: true, address })).status,
        404,
      );

      const eligibility = await mock.call('GET', '/v3/creator-fund/eligibility', {
        signed: true,
        address,
      });
      assert.deepEqual(eligibility.body, { eligible: true, reasons: [] });

      const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
      const invalid = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, email: 'nope', terms_version: version },
      });
      assert.equal(invalid.status, 400);
      assert.equal(typeof invalid.body.message, 'string');
      const stale = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: version - 1 },
      });
      assert.equal(stale.status, 400);
      const notInteger = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: String(version) },
      });
      assert.equal(notInteger.status, 400);

      const joined = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: version },
      });
      assert.equal(joined.status, 201);
      assert.equal(joined.body.status, 'active');
      assert.equal(joined.body.terms_version, version);
      assert.equal(typeof joined.body.enrolled_at, 'string');

      const enrollment = await mock.call('GET', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
      });
      assert.equal(enrollment.status, 200);
      assert.equal(enrollment.body.email, CONTACT.email);
      assert.equal(typeof enrollment.body.terms_version, 'number');

      const again = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: version },
      });
      assert.equal(again.status, 200);
    });

    it('binds the PUT body to the signature with hashPayload', async () => {
      const address = '0x00000000000000000000000000000000000000d3';
      const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
      const raw = JSON.stringify({ ...CONTACT, terms_version: version });

      const missing = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        raw,
        hash: null,
      });
      assert.equal(missing.status, 401);
      const wrong = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        raw,
        hash: createHash('sha256').update(`${raw} `, 'utf8').digest('hex'),
      });
      assert.equal(wrong.status, 401);
      const upper = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        raw,
        hash: createHash('sha256').update(raw, 'utf8').digest('hex').toUpperCase(),
      });
      assert.equal(upper.status, 201);
      const tooBig = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        raw: JSON.stringify({ ...CONTACT, terms_version: version, padding: 'x'.repeat(5000) }),
      });
      assert.equal(tooBig.status, 413);
    });

    it('keeps each signer separate', async () => {
      const other = await mock.call('GET', '/v3/creator-fund/enrollment', {
        signed: true,
        address: '0x00000000000000000000000000000000000000c2',
      });
      assert.equal(other.status, 404);
    });

    it('serves my places for the running cycle by default, without paging', async () => {
      const cycles = (await mock.call('GET', '/v3/creator-fund/cycles')).body.cycles;
      const running = cycles.find(cycle => cycle.status === 'running');
      const { status, body } = await mock.call('GET', '/v3/creator-fund/places', { signed: true });
      assert.equal(status, 200);
      assert.equal(body.cycle.id, running.id);
      const statuses = new Set(body.places.map(place => place.status));
      assert.deepEqual([...statuses].sort(), ['eligible', 'not_eligible', 'replaced']);
      const reasons = new Set(body.places.flatMap(place => place.reasons));
      assert.deepEqual([...reasons].sort(), ['content_policy', 'excluded', 'not_owner']);
      const collaborator = body.places.find(place => place.role === 'collaborator');
      assert.equal(collaborator.status, 'not_eligible');
      assert.deepEqual(collaborator.reasons, ['not_owner']);
      for (const place of body.places) {
        assert.match(place.base_position, /^-?\d+,-?\d+$/);
        assert.equal(typeof place.world, 'boolean');
      }
    });

    it('marks a place eligible before joining and in program after', async () => {
      const address = '0x00000000000000000000000000000000000000e1';
      const statusesOf = async () =>
        new Set(
          (await mock.call('GET', '/v3/creator-fund/places', { signed: true, address })).body.places
            .filter(place => place.reasons.length === 0)
            .map(place => place.status),
        );
      assert.deepEqual([...(await statusesOf())].sort(), ['eligible', 'replaced']);
      const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
      await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: version },
      });
      assert.deepEqual([...(await statusesOf())].sort(), ['in_program', 'replaced']);
    });

    it('has no places in a closed cycle that ended before the signer joined', async () => {
      const address = '0x00000000000000000000000000000000000000e2';
      const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
      await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        address,
        body: { ...CONTACT, terms_version: version },
      });
      const closed = (await mock.call('GET', '/v3/creator-fund/cycles')).body.cycles.find(
        cycle => cycle.status === 'closed',
      );
      const { body } = await mock.call('GET', `/v3/creator-fund/places?cycle=${closed.id}`, {
        signed: true,
        address,
      });
      assert.deepEqual(body, { cycle: closed, places: [] });
    });

    it('serves my places for a named cycle and 404s an unknown one', async () => {
      const closed = (await mock.call('GET', '/v3/creator-fund/cycles')).body.cycles.find(
        cycle => cycle.status === 'closed',
      );
      const named = await mock.call('GET', `/v3/creator-fund/places?cycle=${closed.id}`, {
        signed: true,
      });
      assert.equal(named.body.cycle.id, closed.id);
      const unknown = await mock.call('GET', '/v3/creator-fund/places?cycle=999', { signed: true });
      assert.equal(unknown.status, 404);
      const notInteger = await mock.call('GET', '/v3/creator-fund/places?cycle=nope', {
        signed: true,
      });
      assert.equal(notInteger.status, 400);
    });

    it('answers analytics metrics positionally, with some nulls', async () => {
      const locations = [
        { x: 23, y: -14 },
        { world: 'example-world.dcl.eth', x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      const { status, body } = await mock.call('POST', '/v2/metrics', {
        signed: true,
        body: { locations },
      });
      assert.equal(status, 200);
      assert.equal(typeof body.exported_at, 'string');
      assert.equal(body.locations.length, locations.length);
      assert.deepEqual(body.locations[1].world, 'example-world.dcl.eth');
      const names = [
        'new_decentraland_players_30d',
        'd3_retention_rate_30d',
        'avg_playtime_seconds_30d',
      ];
      assert.ok(body.locations.some(location => names.every(name => location.metrics[name])));
      assert.ok(body.locations.some(location => names.some(name => !location.metrics[name])));
    });

    it('serves a multi-scene and a single-scene World on My Places and the Leaderboard', async () => {
      const scenes = async name =>
        (await mock.call('GET', `/world/${encodeURIComponent(name)}/scenes?limit=1&offset=0`)).body
          .total;
      const mine = (await mock.call('GET', '/v3/creator-fund/places', { signed: true })).body
        .places;
      const board = (await mock.call('GET', '/v3/creator-fund/leaderboard')).body.entries.map(
        entry => entry.place,
      );
      for (const list of [mine, board]) {
        const counts = await Promise.all(
          list.filter(place => place.world).map(place => scenes(place.world_name)),
        );
        assert.ok(
          counts.some(count => count > 1),
          'a multi-scene World',
        );
        assert.ok(
          counts.some(count => count === 1),
          'a single-scene World',
        );
      }
      assert.equal(await scenes('example-unknown.dcl.eth'), 0);
    });

    it('serves the mock-only leaderboard and banner', async () => {
      const cycles = (await mock.call('GET', '/v3/creator-fund/cycles')).body.cycles;
      const closed = cycles.filter(cycle => cycle.status === 'closed');
      const latest = closed.sort((a, b) => b.start_at.localeCompare(a.start_at))[0];
      const board = await mock.call('GET', '/v3/creator-fund/leaderboard');
      assert.equal(board.body.cycle_id, null, 'no cycle asked, none echoed');
      assert.equal(board.body.entries.length, 20);
      assert.match(board.body.entries[0].earned_usdc, /^\d+\.\d{2}$/);
      assert.equal(typeof board.body.entries[0].place.base_position, 'string');
      const named = await mock.call('GET', `/v3/creator-fund/leaderboard?cycle=${latest.id}`);
      assert.deepEqual(named.body, { ...board.body, cycle_id: String(latest.id) });
      assert.equal(
        (await mock.call('GET', '/v3/creator-fund/leaderboard?cycle=all')).body.cycle_id,
        'all',
      );
      const running = cycles.find(cycle => cycle.status === 'running');
      assert.equal(
        (await mock.call('GET', `/v3/creator-fund/leaderboard?cycle=${running.id}`)).status,
        400,
      );
      assert.equal((await mock.call('GET', '/v3/creator-fund/leaderboard?cycle=999')).status, 404);
      assert.equal(
        typeof (await mock.call('GET', '/v3/creator-fund/banner')).body.markdown,
        'string',
      );
    });
  });

  for (const reason of ['internal', 'suspended', 'excluded']) {
    describe(`with MOCK_INELIGIBLE=${reason}`, () => {
      let mock;
      before(async () => {
        mock = await startMock({ ineligible: reason });
      });
      after(() => mock.server.close());

      it('reports the reason and refuses the enrollment with it', async () => {
        const eligibility = await mock.call('GET', '/v3/creator-fund/eligibility', {
          signed: true,
        });
        assert.deepEqual(eligibility.body, { eligible: false, reasons: [reason] });
        const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
        const put = await mock.call('PUT', '/v3/creator-fund/enrollment', {
          signed: true,
          body: { ...CONTACT, terms_version: version },
        });
        if (reason === 'suspended') {
          assert.equal(put.status, 409);
        } else {
          assert.equal(put.status, 403);
          assert.deepEqual(put.body, { error: 'Forbidden', reasons: [reason] });
        }
      });
    });
  }

  for (const enrollment of ['suspended']) {
    describe(`with MOCK_ENROLLMENT=${enrollment}`, () => {
      let mock;
      before(async () => {
        mock = await startMock({ enrollment });
      });
      after(() => mock.server.close());

      it('reports the status and refuses a PUT with 409', async () => {
        const got = await mock.call('GET', '/v3/creator-fund/enrollment', { signed: true });
        assert.equal(got.status, 200);
        assert.equal(got.body.status, enrollment);
        const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
        const put = await mock.call('PUT', '/v3/creator-fund/enrollment', {
          signed: true,
          body: { ...CONTACT, terms_version: version },
        });
        assert.equal(put.status, 409);
      });

      it('answers a stale terms_version with 400 before the 409', async () => {
        const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
        const put = await mock.call('PUT', '/v3/creator-fund/enrollment', {
          signed: true,
          body: { ...CONTACT, terms_version: version + 1 },
        });
        assert.equal(put.status, 400);
      });
    });
  }

  describe('with an ineligible wallet that is already suspended', () => {
    let mock;
    before(async () => {
      mock = await startMock({ ineligible: 'internal', enrollment: 'suspended' });
    });
    after(() => mock.server.close());

    it('answers 409 before 403, and a stale terms_version with 400 before both', async () => {
      const { version } = (await mock.call('GET', '/v3/creator-fund/terms')).body;
      const stale = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        body: { ...CONTACT, terms_version: version + 1 },
      });
      const current = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        body: { ...CONTACT, terms_version: version },
      });
      assert.deepEqual([stale.status, current.status], [400, 409]);
    });
  });

  describe('with MOCK_TERMS_VERSION', () => {
    let mock;
    before(async () => {
      mock = await startMock({ termsVersion: 2 });
    });
    after(() => mock.server.close());

    it('bumps the terms after joining and takes a re-accept PUT', async () => {
      const first = (await mock.call('GET', '/v3/creator-fund/terms')).body.version;
      await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        body: { ...CONTACT, terms_version: first },
      });
      assert.equal((await mock.call('GET', '/v3/creator-fund/terms')).body.version, 2);
      assert.equal(
        (await mock.call('GET', '/v3/creator-fund/enrollment', { signed: true })).body
          .terms_version,
        first,
      );

      const outdated = async () =>
        (await mock.call('GET', '/v3/creator-fund/places', { signed: true })).body.places.filter(
          place => place.reasons.includes('terms_outdated'),
        );
      assert.ok((await outdated()).length > 0);

      const stale = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        body: { ...CONTACT, terms_version: first },
      });
      assert.equal(stale.status, 400);
      const reaccept = await mock.call('PUT', '/v3/creator-fund/enrollment', {
        signed: true,
        body: { ...CONTACT, terms_version: 2 },
      });
      assert.equal(reaccept.status, 200);
      assert.equal(reaccept.body.terms_version, 2);
      assert.deepEqual(await outdated(), []);
    });
  });

  describe('with an active enrollment whose wallet became ineligible', () => {
    let mock;
    before(async () => {
      mock = await startMock({ enrollment: 'active', ineligible: 'excluded' });
    });
    after(() => mock.server.close());

    it('marks every owner place creator_not_eligible, stacked on its own reasons', async () => {
      const { places } = (await mock.call('GET', '/v3/creator-fund/places', { signed: true })).body;
      const owned = places.filter(place => place.role === 'owner' && place.status !== 'replaced');
      assert.ok(owned.every(place => place.reasons.includes('creator_not_eligible')));
      assert.ok(owned.some(place => place.reasons.length > 1));
    });
  });

  describe('with MOCK_ENROLLMENT=active, enrolled before the latest closed cycle ended', () => {
    let mock;
    before(async () => {
      mock = await startMock({ enrollment: 'active' });
    });
    after(() => mock.server.close());

    it('serves owner places for that cycle and none for the ones before the join', async () => {
      const closed = (await mock.call('GET', '/v3/creator-fund/cycles')).body.cycles
        .filter(cycle => cycle.status === 'closed')
        .reverse();
      const placesOf = async cycle =>
        (await mock.call('GET', `/v3/creator-fund/places?cycle=${cycle.id}`, { signed: true })).body
          .places;
      const latest = await placesOf(closed[0]);
      assert.ok(latest.length > 0);
      assert.ok(latest.every(place => place.role === 'owner'));
      assert.deepEqual(await placesOf(closed[1]), []);
    });
  });

  describe('with MOCK_NO_RUNNING', () => {
    let mock;
    before(async () => {
      mock = await startMock({ noRunning: true });
    });
    after(() => mock.server.close());

    it('lists only upcoming cycles', async () => {
      const { body } = await mock.call('GET', '/v3/creator-fund/cycles');
      assert.ok(body.cycles.length > 0);
      assert.ok(body.cycles.every(cycle => cycle.status === 'upcoming'));
    });
  });

  describe('with MOCK_NO_CLOSED_CYCLE', () => {
    let mock;
    before(async () => {
      mock = await startMock({ noClosedCycle: true });
    });
    after(() => mock.server.close());

    it('lists no closed cycle and has no default leaderboard', async () => {
      const { body } = await mock.call('GET', '/v3/creator-fund/cycles');
      assert.ok(body.cycles.length > 0);
      assert.ok(body.cycles.every(cycle => cycle.status !== 'closed'));
      assert.equal((await mock.call('GET', '/v3/creator-fund/leaderboard')).status, 404);
    });
  });
});

describe('creator fund mock payouts', () => {
  const P = '/v3/creator-fund';
  const ADDRESS = '0x00000000000000000000000000000000000000c1';
  const WALLET = '0x0000000000000000000000000000000000000002';

  async function joined(mock, address = ADDRESS) {
    const { version } = (await mock.call('GET', `${P}/terms`)).body;
    await mock.call('PUT', `${P}/enrollment`, {
      signed: true,
      address,
      body: { ...CONTACT, terms_version: version },
    });
  }

  describe('with the default switches', () => {
    let mock;
    let now;
    before(async () => {
      now = Date.parse('2026-11-04T10:00:00Z');
      mock = await startMock({ clock: () => now });
      await joined(mock);
    });
    after(() => mock.server.close());

    it('answers 401 to the payout routes without a signature', async () => {
      for (const [method, path] of [
        ['GET', `${P}/payouts`],
        ['GET', `${P}/payout-wallet`],
        ['POST', `${P}/enrollment/email-verification`],
      ]) {
        assert.equal((await mock.call(method, path)).status, 401, path);
      }
    });

    it('serves one pending and two paid payouts, newest first, with their places', async () => {
      const { status, body } = await mock.call('GET', `${P}/payouts`, { signed: true });
      assert.equal(status, 200);
      assert.deepEqual(
        body.payouts.map(payout => payout.status),
        ['pending', 'paid', 'paid'],
      );
      const starts = body.payouts.map(payout => payout.cycle.start_at);
      assert.deepEqual(starts, [...starts].sort().reverse());
      const micro = amount => Math.round(Number(amount) * 1e6);
      for (const payout of body.payouts) {
        assert.equal(payout.paid_places, payout.places.length);
        for (const amount of [payout.amount_usdc, ...payout.places.map(e => e.amount_usdc)]) {
          assert.match(amount, /^\d+(\.\d{1,6})?$/);
        }
        const sum = payout.places.reduce((total, entry) => total + micro(entry.amount_usdc), 0);
        assert.equal(micro(payout.amount_usdc), sum);
        assert.equal(payout.transaction_hash === null, payout.status === 'pending');
        if (payout.transaction_hash) assert.match(payout.transaction_hash, /^0x[0-9a-f]{64}$/);
      }
      assert.ok(
        body.payouts.every(payout =>
          payout.places.some(entry => entry.place.title === 'Cactus Karaoke'),
        ),
      );
      const amounts = body.payouts.flatMap(payout => [
        payout.amount_usdc,
        ...payout.places.map(entry => entry.amount_usdc),
      ]);
      assert.ok(
        amounts.some(amount => /\.\d{3,}$/.test(amount)),
        'a sub-cent amount',
      );
      assert.ok(
        amounts.some(amount => !/\.\d*[1-9]/.test(amount)),
        'a whole amount',
      );
    });

    it('has no payout wallet until one is added, then changes it', async () => {
      assert.equal((await mock.call('GET', `${P}/payout-wallet`, { signed: true })).status, 404);

      const invalid = await mock.call('PUT', `${P}/payout-wallet`, {
        signed: true,
        body: { address: '0x123' },
      });
      assert.deepEqual([invalid.status, invalid.body.error], [400, 'invalid_address']);

      const added = await mock.call('PUT', `${P}/payout-wallet`, {
        signed: true,
        body: { address: WALLET },
      });
      assert.equal(added.status, 201);
      assert.equal(added.body.address, WALLET);
      assert.equal(typeof added.body.updated_at, 'string');

      const changed = await mock.call('PUT', `${P}/payout-wallet`, {
        signed: true,
        body: { address: WALLET.replace('2', '3') },
      });
      assert.equal(changed.status, 200);
      const read = await mock.call('GET', `${P}/payout-wallet`, { signed: true });
      assert.equal(read.body.address, WALLET.replace('2', '3'));
    });

    it('binds the wallet PUT body to the signature with hashPayload', async () => {
      const unbound = await mock.call('PUT', `${P}/payout-wallet`, {
        signed: true,
        body: { address: WALLET },
        hash: 'f'.repeat(64),
      });
      assert.equal(unbound.status, 401);
    });

    it('keeps each signer’s wallet separate', async () => {
      const other = '0x00000000000000000000000000000000000000c2';
      assert.equal(
        (await mock.call('GET', `${P}/payout-wallet`, { signed: true, address: other })).status,
        404,
      );
    });

    it('sends a code, holds a resend for 60 s and lets it expire after 10 minutes', async () => {
      const address = '0x00000000000000000000000000000000000000c3';
      await joined(mock, address);
      const sent = await mock.call('POST', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
      });
      assert.equal(sent.status, 202);
      assert.equal(Date.parse(sent.body.resend_available_at) - Date.parse(sent.body.sent_at), 60e3);
      assert.equal(Date.parse(sent.body.expires_at) - Date.parse(sent.body.sent_at), 600e3);

      const soon = await mock.call('POST', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
      });
      assert.deepEqual([soon.status, soon.body.error], [429, 'too_soon']);

      const wrong = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '123456' },
      });
      assert.deepEqual([wrong.status, wrong.body.error], [400, 'invalid_code']);

      now += 600e3 + 1;
      const expired = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '123456' },
      });
      assert.deepEqual([expired.status, expired.body.error], [410, 'code_expired']);

      const resent = await mock.call('POST', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
      });
      assert.equal(resent.status, 202);
    });

    it('verifies the email with the test code 000000 and refuses a second send', async () => {
      const address = '0x00000000000000000000000000000000000000c4';
      await joined(mock, address);
      await mock.call('POST', `${P}/enrollment/email-verification`, { signed: true, address });

      const confirmed = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '000000' },
      });
      assert.equal(confirmed.status, 200);
      assert.equal(typeof confirmed.body.email_verified_at, 'string');
      const enrollment = await mock.call('GET', `${P}/enrollment`, { signed: true, address });
      assert.equal(enrollment.body.email_verified_at, confirmed.body.email_verified_at);
      const again = await mock.call('POST', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
      });
      assert.equal(again.status, 409);
    });

    it('locks the code after five wrong tries', async () => {
      const address = '0x00000000000000000000000000000000000000c5';
      await joined(mock, address);
      await mock.call('POST', `${P}/enrollment/email-verification`, { signed: true, address });
      const tries = [];
      for (let index = 0; index < 6; index += 1) {
        tries.push(
          (
            await mock.call('PUT', `${P}/enrollment/email-verification`, {
              signed: true,
              address,
              body: { code: '123456' },
            })
          ).body.error,
        );
      }
      assert.deepEqual(tries.slice(-2), ['invalid_code', 'too_many_attempts']);
      const locked = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '000000' },
      });
      assert.deepEqual([locked.status, locked.body.error], [429, 'too_many_attempts']);
    });

    it('refuses the test code once it has expired, or before any code was sent', async () => {
      const address = '0x00000000000000000000000000000000000000c7';
      await joined(mock, address);
      const unsent = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '000000' },
      });
      assert.deepEqual([unsent.status, unsent.body.error], [410, 'code_expired']);
      await mock.call('POST', `${P}/enrollment/email-verification`, { signed: true, address });
      now += 600e3 + 1;
      const expired = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        address,
        body: { code: '000000' },
      });
      assert.deepEqual([expired.status, expired.body.error], [410, 'code_expired']);
    });

    it('404s a verification for a signer who has not joined', async () => {
      const response = await mock.call('POST', `${P}/enrollment/email-verification`, {
        signed: true,
        address: '0x00000000000000000000000000000000000000c6',
      });
      assert.equal(response.status, 404);
    });
  });

  describe('with MOCK_PAYOUT_WALLET, MOCK_EMAIL_VERIFIED and MOCK_NO_PAYOUTS', () => {
    let mock;
    before(async () => {
      mock = await startMock({ payoutWallet: true, emailVerified: true, noPayouts: true });
      await joined(mock);
    });
    after(() => mock.server.close());

    it('starts every signer with a wallet, a verified email and no payouts', async () => {
      const wallet = await mock.call('GET', `${P}/payout-wallet`, { signed: true });
      assert.equal(wallet.status, 200);
      assert.match(wallet.body.address, /^0x[0-9a-fA-F]{40}$/);
      const enrollment = await mock.call('GET', `${P}/enrollment`, {
        signed: true,
        address: ADDRESS,
      });
      assert.equal(typeof enrollment.body.email_verified_at, 'string');
      const payouts = await mock.call('GET', `${P}/payouts`, { signed: true });
      assert.deepEqual(payouts.body, { payouts: [] });
    });
  });

  describe('with MOCK_ENROLLMENT=active', () => {
    let mock;
    before(async () => {
      mock = await startMock({ enrollment: 'active' });
    });
    after(() => mock.server.close());

    it('serves every signer an active, unverified enrollment that can verify its email', async () => {
      const enrollment = await mock.call('GET', `${P}/enrollment`, { signed: true });
      assert.deepEqual(
        [enrollment.status, enrollment.body.status, enrollment.body.email_verified_at],
        [200, 'active', null],
      );
      await mock.call('POST', `${P}/enrollment/email-verification`, { signed: true });
      const confirmed = await mock.call('PUT', `${P}/enrollment/email-verification`, {
        signed: true,
        body: { code: '000000' },
      });
      assert.equal(confirmed.status, 200);
    });
  });

  describe('with a suspended enrollment', () => {
    let mock;
    before(async () => {
      mock = await startMock({ enrollment: 'suspended' });
    });
    after(() => mock.server.close());

    it('refuses a payout wallet with 409', async () => {
      const response = await mock.call('PUT', `${P}/payout-wallet`, {
        signed: true,
        body: { address: WALLET },
      });
      assert.equal(response.status, 409);
    });
  });
});
