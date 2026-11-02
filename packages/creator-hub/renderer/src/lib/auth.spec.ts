import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthServerProvider, SignInError } from './auth';
import { deriveSignInRequestId } from './signInVerifier';

const AUTH_SERVER_URL = 'https://auth-api.example.com';
const IDENTITY_ID = 'f0963d93-f520-4612-9714-8d0d30f7ae6d';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

describe('when fetching a deep-link sign in identity', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    AuthServerProvider.setAuthServerUrl(AUTH_SERVER_URL);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('and the auth server returns the identity', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ identity: { authChain: [{ payload: '0xABC' }] } }), {
          status: 200,
        }),
      );
    });

    it('should send the verifier header', async () => {
      await AuthServerProvider.fetchIdentity(IDENTITY_ID, VERIFIER);
      expect(fetchMock).toHaveBeenCalledWith(`${AUTH_SERVER_URL}/identities/${IDENTITY_ID}`, {
        headers: { 'x-identity-verifier': VERIFIER },
      });
    });

    it('should return the lowercased signer', async () => {
      const { signer } = await AuthServerProvider.fetchIdentity(IDENTITY_ID, VERIFIER);
      expect(signer).toBe('0xabc');
    });
  });

  describe('and the auth server rejects the verifier', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    });

    it('should throw a sign in error with the verifier reason', async () => {
      await expect(AuthServerProvider.fetchIdentity(IDENTITY_ID, VERIFIER)).rejects.toMatchObject(
        new SignInError('verifier', 'Sign in identity belongs to another sign in request'),
      );
    });
  });
});

describe('when creating a deep-link sign in request', () => {
  let request: { requestId: string; verifier: string };

  beforeEach(async () => {
    request = await AuthServerProvider.createSignInRequest();
  });

  it('should return a request id derived from the returned verifier', async () => {
    expect(request.requestId).toBe(await deriveSignInRequestId(request.verifier));
  });
});
