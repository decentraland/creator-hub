import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CreatorFundPlace,
  Cycle,
  Enrollment,
  MyPlaces,
} from '../../../../../shared/types/creator-fund';
import * as api from '../../../lib/creatorFundApi';
import * as metricsApi from '../../../lib/metricsApi';
import { Worlds } from '../../../lib/worlds';
import { createTestStore } from '../../../../tests/utils/testStore';
import { FeatureFlag, fetchFeatureFlags } from '../featureFlags';
import { actions, selectors } from './slice';

vi.mock('../../../lib/creatorFundApi', () => ({
  getTerms: vi.fn(),
  getEnrollment: vi.fn(),
  putEnrollment: vi.fn(),
  getEligibility: vi.fn(),
  getCycles: vi.fn(),
  getLeaderboard: vi.fn(),
  getPlaces: vi.fn(),
  getNews: vi.fn(),
  getBanner: vi.fn(),
  getPayouts: vi.fn(),
  getPayoutWallet: vi.fn(),
  putPayoutWallet: vi.fn(),
  postEmailVerification: vi.fn(),
  putEmailVerification: vi.fn(),
}));
vi.mock('../../../lib/metricsApi', () => ({ fetchMetrics: vi.fn() }));
vi.mock('../../../lib/worlds', () => ({ Worlds: vi.fn() }));
Worlds.prototype.fetchWorldScenes = vi.fn();

const ok = <T>(data: T, status = 200) => ({ ok: true as const, status, data });
const fail = (status: number, body?: object) => ({
  ok: false as const,
  status,
  error: 'Something went wrong',
  body: body as any,
});

const cycle = (id: number, start: string, end: string, status: Cycle['status']): Cycle => ({
  id,
  start_at: `${start}T00:00:00Z`,
  end_at: `${end}T00:00:00Z`,
  pool_usdc: 10000,
  status,
});

const UPCOMING = cycle(4, '2026-11-16', '2026-12-01', 'upcoming');
const RUNNING = cycle(3, '2026-11-01', '2026-11-16', 'running');
const CLOSED_NEW = cycle(2, '2026-10-16', '2026-11-01', 'closed');
const CLOSED_OLD = cycle(1, '2026-10-01', '2026-10-16', 'closed');

const ENROLLMENT: Enrollment = {
  status: 'active',
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

const TERMS = (version: string) => ({
  version,
  title: 'Example Terms',
  published_at: '2026-10-22T00:00:00Z',
  content: '# Terms',
});

const place = (id: string, overrides: Partial<CreatorFundPlace> = {}): CreatorFundPlace => ({
  id,
  title: `Example Place ${id}`,
  image: null,
  world: false,
  world_name: null,
  base_position: '23,-14',
  positions: ['23,-14'],
  owner: '0x0000000000000000000000000000000000000001',
  role: 'owner',
  status: 'in_program',
  reasons: [],
  ...overrides,
});

const places = (cycleObject: Cycle, list: CreatorFundPlace[]): MyPlaces => ({
  cycle: cycleObject,
  places: list,
});

describe('creatorFund slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  describe('when fetching the enrollment', () => {
    it("should read the service's not-enrolled 404 as not enrolled", async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(
        fail(404, { error: 'Not Found', message: 'not enrolled' }),
      );

      await store.dispatch(actions.fetchEnrollment());

      expect(store.getState().creatorFund.enrollment).toMatchObject({
        data: null,
        status: 'succeeded',
      });
    });

    it.each([
      ['no body', undefined],
      ['another message', { error: 'Not Found', message: 'No route for GET /v3/creator-fund/x' }],
    ])('should keep any other 404 (%s) as a load error', async (_name, body) => {
      vi.mocked(api.getEnrollment).mockResolvedValue(fail(404, body));

      await store.dispatch(actions.fetchEnrollment());

      expect(store.getState().creatorFund.enrollment).toMatchObject({
        data: null,
        status: 'failed',
        failure: { status: 404 },
      });
    });

    it('should store an enrollment', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(ENROLLMENT));

      await store.dispatch(actions.fetchEnrollment());

      expect(store.getState().creatorFund.enrollment.data).toEqual(ENROLLMENT);
    });

    it('should keep any other failure', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(fail(401));

      await store.dispatch(actions.fetchEnrollment());

      expect(store.getState().creatorFund.enrollment).toMatchObject({
        status: 'failed',
        failure: { status: 401 },
      });
    });
  });

  describe('when reading whether the terms must be re-accepted', () => {
    it.each([
      ['active on an older version', ENROLLMENT, 2, true],
      ['active on the current version', ENROLLMENT, 1, false],
      ['suspended on an older version', { ...ENROLLMENT, status: 'suspended' }, 2, false],
    ])('should answer for an enrollment %s', async (_name, enrollment, version, expected) => {
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment as Enrollment));
      vi.mocked(api.getTerms).mockResolvedValue(ok(TERMS(version)));

      await store.dispatch(actions.fetchEnrollment());
      await store.dispatch(actions.fetchTerms());

      expect(selectors.needsReaccept(store.getState())).toBe(expected);
    });

    it('should be false until both the enrollment and the terms are known', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(ENROLLMENT));
      await store.dispatch(actions.fetchEnrollment());

      expect(selectors.needsReaccept(store.getState())).toBe(false);
    });
  });

  describe('when saving the enrollment', () => {
    it('should PUT it and store the answer', async () => {
      const request = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        terms_version: 2,
      };
      vi.mocked(api.putEnrollment).mockResolvedValue(ok({ ...ENROLLMENT, terms_version: 2 }));

      await store.dispatch(actions.saveEnrollment(request));

      expect(api.putEnrollment).toHaveBeenCalledWith(request);
      expect(store.getState().creatorFund.enrollment.data?.terms_version).toBe(2);
    });

    it('should keep the refusal with its reasons', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(fail(403, { reasons: ['internal'] }));

      await store.dispatch(
        actions.saveEnrollment({ first_name: 'a', last_name: 'b', email: 'c', terms_version: 1 }),
      );

      expect(store.getState().creatorFund.enrollmentSave.failure).toMatchObject({
        status: 403,
        body: { reasons: ['internal'] },
      });
    });
  });

  describe('when checking eligibility', () => {
    it('should store the wallet reasons', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue(
        ok({ eligible: false, reasons: ['internal', 'excluded'] }),
      );

      await store.dispatch(actions.fetchEligibility());

      expect(store.getState().creatorFund.eligibility.data?.reasons).toEqual([
        'internal',
        'excluded',
      ]);
    });
  });

  describe('when the cycles are loaded', () => {
    beforeEach(async () => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: [CLOSED_OLD, RUNNING, UPCOMING, CLOSED_NEW] }),
      );
      await store.dispatch(actions.fetchCycles());
    });

    it('should list them newest first', () => {
      expect(selectors.getSortedCycles(store.getState()).map(entry => entry.id)).toEqual([
        UPCOMING.id,
        RUNNING.id,
        CLOSED_NEW.id,
        CLOSED_OLD.id,
      ]);
    });

    it('should pick the newest closed cycle as the latest closed one', () => {
      expect(selectors.getLatestClosedCycle(store.getState())?.id).toBe(CLOSED_NEW.id);
    });

    it('should list My Places cycles with the running one first, then the closed newest first, never an upcoming one', () => {
      expect(selectors.getMyPlacesCycles(store.getState()).map(entry => entry.id)).toEqual([
        RUNNING.id,
        CLOSED_NEW.id,
        CLOSED_OLD.id,
      ]);
    });

    it('should default My Places to the running cycle', () => {
      expect(selectors.getDefaultPlacesCycle(store.getState())?.id).toBe(RUNNING.id);
    });

    it('should label a cycle by id', () => {
      expect(selectors.getCycleLabel(store.getState(), CLOSED_OLD.id)).toBe('Oct 1 - Oct 15, 2026');
    });
  });

  describe.each([
    [
      'nothing runs',
      [CLOSED_OLD, UPCOMING, CLOSED_NEW],
      [CLOSED_NEW.id, CLOSED_OLD.id],
      CLOSED_NEW.id,
    ],
    [
      'only closed cycles exist',
      [CLOSED_OLD, CLOSED_NEW],
      [CLOSED_NEW.id, CLOSED_OLD.id],
      CLOSED_NEW.id,
    ],
    ['only an upcoming cycle exists', [UPCOMING], [], null],
    ['no cycle exists', [], [], null],
  ])('when %s', (_name, list, options, expected) => {
    it('should list the My Places cycles newest first and default to the first, or none', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles: list }));
      await store.dispatch(actions.fetchCycles());

      expect(selectors.getMyPlacesCycles(store.getState()).map(entry => entry.id)).toEqual(options);
      expect(selectors.getDefaultPlacesCycle(store.getState())?.id ?? null).toBe(expected);
    });
  });

  describe('when the Creator Fund flag sets a program start date', () => {
    const TEST_CYCLE: Cycle = {
      id: 4,
      start_at: '2026-11-02T15:10:00.000Z',
      end_at: '2026-11-10T15:10:00.000Z',
      pool_usdc: 1,
      status: 'closed',
    };
    const launch = (id: number, start: string, end: string): Cycle => ({
      id,
      start_at: `${start}T03:00:00.000Z`,
      end_at: `${end}T03:00:00.000Z`,
      pool_usdc: 10000,
      status: 'upcoming',
    });
    const LAUNCH_CYCLES = [
      TEST_CYCLE,
      launch(1, '2026-11-15', '2026-12-01'),
      launch(2, '2026-12-01', '2026-12-16'),
      launch(3, '2026-12-16', '2027-01-01'),
    ];
    const variant = (value: string, enabled = true) => ({
      name: 'launch',
      enabled,
      payload: { type: 'json', value },
    });

    async function loadWithVariant(flagVariant?: ReturnType<typeof variant>) {
      store.dispatch(
        fetchFeatureFlags.fulfilled(
          {
            flags: { [FeatureFlag.CREATOR_FUND]: true },
            variants: flagVariant ? { [FeatureFlag.CREATOR_FUND]: flagVariant } : {},
          },
          '',
        ),
      );
      vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles: LAUNCH_CYCLES }));
      await store.dispatch(actions.fetchCycles());
    }

    describe.each([
      ['', '{"startDate":"2026-11-15T03:00:00Z"}'],
      [' in the live payload, with its leading space', ' {"startDate":"2026-11-15T03:00:00Z"}'],
    ])('and a cycle starts before it%s', (_name, value) => {
      beforeEach(() => loadWithVariant({ ...variant(value), name: 'cycle_start' }));

      it('should hide that cycle and keep the ones from the start date on', () => {
        expect(selectors.getSortedCycles(store.getState()).map(entry => entry.id)).toEqual([
          3, 2, 1,
        ]);
      });

      it('should have no latest closed cycle, no My Places cycle, and cycle 1 as the first', () => {
        const state = store.getState();
        expect(selectors.getLatestClosedCycle(state)).toBeNull();
        expect(selectors.getMyPlacesCycles(state)).toEqual([]);
        expect(selectors.getFirstCycle(state)?.id).toBe(1);
        expect(selectors.getFirstPayoutCycle(state)?.id).toBe(1);
      });
    });

    describe.each([
      ['there is no variant', undefined],
      ['the variant is disabled', variant('{"startDate":"2026-11-15T03:00:00Z"}', false)],
      ['the payload is not JSON', variant('2026-11-15T03:00:00Z')],
      ['the payload is JSON null', variant('null')],
      ['the payload has no startDate', variant('{"start":"2026-11-15T03:00:00Z"}')],
      ['the startDate is not a date', variant('{"startDate":"soon"}')],
      ['the startDate is not a string', variant('{"startDate":123}')],
    ])('when %s', (_name, flagVariant) => {
      it('should show every cycle', async () => {
        await loadWithVariant(flagVariant);

        expect(selectors.getSortedCycles(store.getState()).map(entry => entry.id)).toEqual([
          3, 2, 1, 4,
        ]);
        expect(selectors.getLatestClosedCycle(store.getState())?.id).toBe(4);
      });
    });
  });

  describe('when counting the scenes of a World', () => {
    it('should ask the Worlds content server once per World and keep its total', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({
        scenes: [],
        total: 3,
      } as any);

      await store.dispatch(actions.fetchWorldSceneCount('example-world.dcl.eth'));
      await store.dispatch(actions.fetchWorldSceneCount('example-world.dcl.eth'));

      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledTimes(1);
      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledWith('example-world.dcl.eth', {
        limit: 1,
        offset: 0,
      });
      expect(store.getState().creatorFund.worldSceneCounts).toEqual({ 'example-world.dcl.eth': 3 });
    });

    it('should leave a World it could not count unknown', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue(null);

      await store.dispatch(actions.fetchWorldSceneCount('example-world.dcl.eth'));

      expect(store.getState().creatorFund.worldSceneCounts).toEqual({});
    });

    it('should forget the counts on clearState', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({
        scenes: [],
        total: 2,
      } as any);
      await store.dispatch(actions.fetchWorldSceneCount('example-world.dcl.eth'));

      store.dispatch(actions.clearState());

      expect(store.getState().creatorFund.worldSceneCounts).toEqual({});
    });
  });

  describe('when fetching my places', () => {
    it('should ask for the cycle and store the list', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(ok(places(RUNNING, [place('a')])));

      await store.dispatch(actions.fetchPlaces(RUNNING.id));

      expect(api.getPlaces).toHaveBeenCalledWith(RUNNING.id);
      expect(store.getState().creatorFund.places.data?.places.map(entry => entry.id)).toEqual([
        'a',
      ]);
    });

    it('should keep the newer answer when an older request answers last', async () => {
      let answerSlow: (value: unknown) => void = () => {};
      vi.mocked(api.getPlaces)
        .mockReturnValueOnce(new Promise(resolve => (answerSlow = resolve)) as any)
        .mockResolvedValueOnce(ok(places(CLOSED_NEW, [place('new')])));

      const slow = store.dispatch(actions.fetchPlaces(RUNNING.id));
      await store.dispatch(actions.fetchPlaces(CLOSED_NEW.id));
      answerSlow(ok(places(RUNNING, [place('stale')])));
      await slow;

      expect(store.getState().creatorFund.places.data?.places.map(entry => entry.id)).toEqual([
        'new',
      ]);
    });
  });

  describe('when fetching the metrics of my places', () => {
    it('should ask by world name or base position and key the answer by place', async () => {
      vi.mocked(metricsApi.fetchMetrics).mockResolvedValue({
        exported_at: '2026-11-03T15:24:00Z',
        source: 'test',
        locations: [
          { location_key: 'k1', builder_project_id: null, x: 23, y: -14, metrics: { a: [] } },
          {
            location_key: 'k2',
            builder_project_id: null,
            world: 'example-world.dcl.eth',
            x: 0,
            y: 0,
            metrics: { b: [] },
          },
        ],
      });

      await store.dispatch(
        actions.fetchPlaceMetrics([
          place('genesis'),
          place('world', {
            world: true,
            world_name: 'example-world.dcl.eth',
            base_position: '0,0',
          }),
        ]),
      );

      expect(metricsApi.fetchMetrics).toHaveBeenCalledWith([
        { x: 23, y: -14 },
        { world: 'example-world.dcl.eth', x: 0, y: 0 },
      ]);
      const { data } = store.getState().creatorFund.placeMetrics;
      expect(data?.exported_at).toBe('2026-11-03T15:24:00Z');
      expect(Object.keys(data?.byPlaceId ?? {})).toEqual(['genesis', 'world']);
      expect(data?.byPlaceId.world.metrics).toEqual({ b: [] });
    });
  });

  describe('when there is no banner', () => {
    it('should succeed with no banner', async () => {
      vi.mocked(api.getBanner).mockResolvedValue(ok(null, 204));

      await store.dispatch(actions.fetchBanner());

      expect(store.getState().creatorFund.banner).toMatchObject({
        data: null,
        status: 'succeeded',
      });
    });
  });

  describe('when fetching the news', () => {
    it('should store them', async () => {
      vi.mocked(api.getNews).mockResolvedValue(ok({ news: [] }));

      await store.dispatch(actions.fetchNews());

      expect(store.getState().creatorFund.news.data).toEqual({ news: [] });
    });
  });

  describe('when fetching the payout wallet', () => {
    it('should read a 404 as no wallet', async () => {
      vi.mocked(api.getPayoutWallet).mockResolvedValue(fail(404));

      await store.dispatch(actions.fetchPayoutWallet());

      expect(store.getState().creatorFund.payoutWallet).toMatchObject({
        data: null,
        status: 'succeeded',
      });
    });

    it('should keep any other failure', async () => {
      vi.mocked(api.getPayoutWallet).mockResolvedValue(fail(500));

      await store.dispatch(actions.fetchPayoutWallet());

      expect(store.getState().creatorFund.payoutWallet.status).toBe('failed');
    });
  });

  describe('when saving the payout wallet', () => {
    const WALLET = {
      address: '0x0000000000000000000000000000000000000002',
      updated_at: '2026-11-04T10:00:00Z',
    };

    it('should PUT it and put the answer on the card without fetching it again', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue(ok(WALLET, 201));

      await store.dispatch(actions.savePayoutWallet({ address: WALLET.address }));

      expect(api.putPayoutWallet).toHaveBeenCalledWith({ address: WALLET.address });
      expect(store.getState().creatorFund.payoutWallet).toMatchObject({
        data: WALLET,
        status: 'succeeded',
      });
      expect(api.getPayoutWallet).not.toHaveBeenCalled();
    });

    it('should keep the card as it was when the PUT is refused', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue(fail(400, { error: 'invalid_address' }));

      await store.dispatch(actions.savePayoutWallet({ address: '0x1' }));

      expect(store.getState().creatorFund.payoutWallet.data).toBeNull();
      expect(store.getState().creatorFund.payoutWalletSave.failure).toMatchObject({
        status: 400,
        body: { error: 'invalid_address' },
      });
    });
  });

  describe('when verifying the email', () => {
    const SENT = {
      sent_at: '2026-11-04T10:00:00Z',
      expires_at: '2026-11-04T10:10:00Z',
      resend_available_at: '2026-11-04T10:01:00Z',
    };

    it('should keep the timings of the sent code', async () => {
      vi.mocked(api.postEmailVerification).mockResolvedValue(ok(SENT, 202));

      await store.dispatch(actions.sendEmailVerification());

      expect(store.getState().creatorFund.emailVerification.data).toEqual(SENT);
    });

    it('should put the verified enrollment in place once the code is confirmed', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(ENROLLMENT));
      await store.dispatch(actions.fetchEnrollment());
      const verified = { ...ENROLLMENT, email_verified_at: '2026-11-04T10:02:00Z' };
      vi.mocked(api.putEmailVerification).mockResolvedValue(ok(verified));

      await store.dispatch(actions.confirmEmailVerification({ code: '000000' }));

      expect(api.putEmailVerification).toHaveBeenCalledWith({ code: '000000' });
      expect(store.getState().creatorFund.enrollment.data).toEqual(verified);
      expect(api.getEnrollment).toHaveBeenCalledTimes(1);
    });

    it('should keep a wrong code as a failure and the enrollment unverified', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(ENROLLMENT));
      await store.dispatch(actions.fetchEnrollment());
      vi.mocked(api.putEmailVerification).mockResolvedValue(fail(400, { error: 'invalid_code' }));

      await store.dispatch(actions.confirmEmailVerification({ code: '123456' }));

      expect(store.getState().creatorFund.enrollment.data?.email_verified_at).toBeNull();
      expect(store.getState().creatorFund.emailVerificationConfirm.failure).toMatchObject({
        status: 400,
        body: { error: 'invalid_code' },
      });
    });
  });

  describe('when signing out or switching accounts', () => {
    it('should forget the payouts, the wallet and the verification', async () => {
      vi.mocked(api.getPayouts).mockResolvedValue(ok({ payouts: [] }));
      vi.mocked(api.getPayoutWallet).mockResolvedValue(
        ok({ address: '0x0000000000000000000000000000000000000002', updated_at: 'x' }),
      );
      vi.mocked(api.postEmailVerification).mockResolvedValue(
        ok({ sent_at: 'a', expires_at: 'b', resend_available_at: 'c' }),
      );
      await store.dispatch(actions.fetchPayouts());
      await store.dispatch(actions.fetchPayoutWallet());
      await store.dispatch(actions.sendEmailVerification());

      store.dispatch(actions.clearState());

      const state = store.getState().creatorFund;
      expect([state.payouts, state.payoutWallet, state.emailVerification]).toEqual([
        expect.objectContaining({ data: null, status: 'idle' }),
        expect.objectContaining({ data: null, status: 'idle' }),
        expect.objectContaining({ data: null, status: 'idle' }),
      ]);
    });

    it("should drop the previous account's wallet answer that lands after the switch", async () => {
      let answer!: (value: unknown) => void;
      vi.mocked(api.getPayoutWallet).mockReturnValue(
        new Promise(resolve => (answer = resolve)) as never,
      );
      const pending = store.dispatch(actions.fetchPayoutWallet());
      store.dispatch(actions.clearState());

      answer(ok({ address: '0x0000000000000000000000000000000000000002', updated_at: 'x' }));
      await pending;

      expect(store.getState().creatorFund.payoutWallet.data).toBeNull();
    });
  });

  describe('when naming the cycle of the first payout', () => {
    it.each([
      ['the running cycle', [CLOSED_OLD, RUNNING, UPCOMING], RUNNING],
      [
        'the next upcoming cycle when none runs',
        [cycle(6, '2026-12-01', '2026-12-16', 'upcoming'), UPCOMING],
        UPCOMING,
      ],
      ['nothing when there is neither', [CLOSED_OLD], null],
    ])('should pick %s', async (_name, cycles, expected) => {
      vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles }));

      await store.dispatch(actions.fetchCycles());

      expect(selectors.getFirstPayoutCycle(store.getState())).toEqual(expected);
    });
  });
});
