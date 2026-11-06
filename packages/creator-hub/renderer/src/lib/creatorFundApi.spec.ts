import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = 'http://localhost:8788';
const ADDRESS = '0xdeadbeef';
const WALLET = '0x0000000000000000000000000000000000000001';

const signedHeaders = vi.fn(() => new Headers({ 'x-identity-auth-chain-0': '{"type":"SIGNER"}' }));

vi.mock('decentraland-crypto-fetch', () => ({ signedHeaderFactory: () => signedHeaders }));
vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: vi.fn(() => ({ ephemeralIdentity: {}, authChain: [] })),
}));
vi.mock('/@/config', () => ({ config: { get: () => BASE } }));
vi.mock('./auth', () => ({ AuthServerProvider: { getAccount: vi.fn(() => ADDRESS) } }));

const { metrics } = await import('#preload');
const api = await import('./creatorFundApi');

const lastRequest = () => vi.mocked(metrics.request).mock.calls.at(-1)![0];
const lastSigned = () =>
  signedHeaders.mock.calls.at(-1) as unknown as [unknown, string, string, Record<string, string>];

describe('creatorFundApi', () => {
  beforeEach(() => {
    signedHeaders.mockClear();
    vi.mocked(metrics.request).mockReset();
    vi.mocked(metrics.request).mockResolvedValue({ ok: true, status: 200, data: {} });
  });

  describe('when calling a public route', () => {
    it('should GET it under /v3/creator-fund at the host root without signing', async () => {
      await api.getTerms();

      expect(lastRequest()).toEqual({
        baseUrl: BASE,
        path: '/v3/creator-fund/terms',
        method: 'GET',
        headers: undefined,
        body: undefined,
      });
      expect(signedHeaders).not.toHaveBeenCalled();
    });

    it.each([
      ['cycles', () => api.getCycles(), '/v3/creator-fund/cycles'],
      ['news', () => api.getNews(), '/v3/creator-fund/news'],
      ['banner', () => api.getBanner(), '/v3/creator-fund/banner'],
      ['leaderboard', () => api.getLeaderboard('all'), '/v3/creator-fund/leaderboard?cycle=all'],
    ])('should send %s unsigned', async (_name, call, path) => {
      await call();

      expect(lastRequest()).toMatchObject({ path, method: 'GET', headers: undefined });
      expect(signedHeaders).not.toHaveBeenCalled();
    });
  });

  describe('when calling a signed route', () => {
    const enrollment = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@example.com',
      terms_version: 1,
    };

    it.each([
      ['eligibility', () => api.getEligibility(), 'get', '/v3/creator-fund/eligibility'],
      ['enrollment', () => api.getEnrollment(), 'get', '/v3/creator-fund/enrollment'],
      [
        'the enrollment write',
        () => api.putEnrollment(enrollment),
        'put',
        '/v3/creator-fund/enrollment',
      ],
      ['places', () => api.getPlaces(), 'get', '/v3/creator-fund/places'],
      ['payouts', () => api.getPayouts(), 'get', '/v3/creator-fund/payouts'],
      ['the payout wallet', () => api.getPayoutWallet(), 'get', '/v3/creator-fund/payout-wallet'],
      [
        'the payout wallet write',
        () => api.putPayoutWallet({ address: WALLET }),
        'put',
        '/v3/creator-fund/payout-wallet',
      ],
      [
        'the verification send',
        () => api.postEmailVerification(),
        'post',
        '/v3/creator-fund/enrollment/email-verification',
      ],
      [
        'the verification confirm',
        () => api.putEmailVerification({ code: '000000' }),
        'put',
        '/v3/creator-fund/enrollment/email-verification',
      ],
    ])('should sign %s with its method and pathname', async (_name, call, method, path) => {
      await call();

      const [, signedMethod, signedPath] = lastSigned();
      expect(signedMethod).toBe(method);
      expect(signedPath).toBe(path);
      expect(lastRequest()).toMatchObject({
        path,
        method: method.toUpperCase(),
        headers: { 'x-identity-auth-chain-0': '{"type":"SIGNER"}' },
      });
    });

    it('should PUT the enrollment serialized once, signing the sha256 of those exact bytes', async () => {
      await api.putEnrollment(enrollment);

      const { rawBody, body } = lastRequest();
      expect(body).toBeUndefined();
      expect(JSON.parse(rawBody!)).toEqual(enrollment);
      const [, , , metadata] = lastSigned();
      expect(metadata).toEqual({
        hashPayload: createHash('sha256').update(rawBody!, 'utf8').digest('hex'),
      });
    });

    it.each([
      ['payout wallet', () => api.putPayoutWallet({ address: WALLET }), { address: WALLET }],
      ['verification code', () => api.putEmailVerification({ code: '000000' }), { code: '000000' }],
    ])(
      'should PUT the %s serialized once, signing the sha256 of those exact bytes',
      async (_name, call, sent) => {
        await call();

        const { rawBody, body } = lastRequest();
        expect(body).toBeUndefined();
        expect(JSON.parse(rawBody!)).toEqual(sent);
        expect(lastSigned()[3]).toEqual({
          hashPayload: createHash('sha256').update(rawBody!, 'utf8').digest('hex'),
        });
      },
    );

    it('should POST the verification send with no body and empty metadata', async () => {
      await api.postEmailVerification();

      expect(lastRequest()).toMatchObject({ method: 'POST', rawBody: undefined });
      expect(lastSigned()[3]).toEqual({});
    });

    it('should sign the reads with empty metadata', async () => {
      await api.getEnrollment();

      expect(lastSigned()[3]).toEqual({});
    });

    it('should ask for a cycle in the query and sign the pathname only', async () => {
      await api.getPlaces(7);

      expect(lastRequest().path).toBe('/v3/creator-fund/places?cycle=7');
      expect(lastSigned()[2]).toBe('/v3/creator-fund/places');
    });

    it('should fail as a value when there is no connected account', async () => {
      const { AuthServerProvider } = await import('./auth');
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(undefined as any);

      const response = await api.getEnrollment();

      expect(response).toMatchObject({ ok: false, status: 0, error: 'No connected account found' });
      expect(metrics.request).not.toHaveBeenCalled();
    });
  });

  describe('when the service refuses the enrollment', () => {
    it('should hand the reasons back rather than throwing', async () => {
      const failure = {
        ok: false as const,
        status: 403,
        error: 'Not eligible',
        body: { error: 'Forbidden', message: 'Not eligible', reasons: ['internal'] },
      };
      vi.mocked(metrics.request).mockResolvedValue(failure);

      expect(
        await api.putEnrollment({
          first_name: 'a',
          last_name: 'b',
          email: 'c',
          terms_version: 1,
        }),
      ).toEqual(failure);
    });
  });
});
