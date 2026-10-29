import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveSignInRequestId } from './signInVerifier';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const AUTH_CHAIN = [{ type: 'SIGNER', payload: ACCOUNT, signature: '' }];

const getIdentityMock = vi.fn();
const ioMock = vi.fn();

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: (...args: unknown[]) => getIdentityMock(...args),
  localStorageStoreIdentity: vi.fn(),
  localStorageClearIdentity: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => ioMock(...args) }));

const { AuthServerProvider, RelayError, SignInError } = await import('./auth');

function fakeSocket(outcome: object | undefined) {
  return {
    on: (event: string, listener: (msg: unknown) => void) => {
      if (event === 'connect') queueMicrotask(() => listener(undefined));
      if (event === 'outcome' && outcome) {
        queueMicrotask(() => listener({ requestId: 'req-1', ...outcome }));
      }
    },
    off: vi.fn(),
    disconnect: vi.fn(),
    emitWithAck: vi.fn(async () => ({
      requestId: 'req-1',
      expiration: new Date(Date.now() + 50).toISOString(),
    })),
  };
}

const sendTransaction = () =>
  new AuthServerProvider().request({
    method: 'eth_sendTransaction',
    params: [{ to: ACCOUNT, data: '0x' }],
  });

describe('AuthServerProvider.request', () => {
  beforeEach(() => {
    AuthServerProvider.setOpenBrowser(vi.fn());
    localStorage.setItem('auth-server-provider-address', ACCOUNT);
  });

  afterEach(() => {
    localStorage.clear();
    getIdentityMock.mockReset();
    ioMock.mockReset();
  });

  describe('when there is no live identity', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(null);
    });

    it('should refuse with a no_identity error before opening a socket', async () => {
      await expect(sendTransaction()).rejects.toMatchObject({
        name: 'RelayError',
        reason: 'no_identity',
      });
      expect(ioMock).not.toHaveBeenCalled();
    });
  });

  describe('when there is a live identity', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue({ authChain: AUTH_CHAIN });
    });

    describe('and the wallet returns a hash', () => {
      let socket: ReturnType<typeof fakeSocket>;

      beforeEach(() => {
        socket = fakeSocket({ result: '0xhash' });
        ioMock.mockReturnValue(socket);
      });

      it('should send only method, params and authChain to the server', async () => {
        await sendTransaction();

        expect(socket.emitWithAck).toHaveBeenCalledWith('request', {
          method: 'eth_sendTransaction',
          params: [{ to: ACCOUNT, data: '0x' }],
          authChain: AUTH_CHAIN,
        });
      });

      it('should resolve with the hash', async () => {
        await expect(sendTransaction()).resolves.toBe('0xhash');
      });
    });

    describe('and the user rejects it in the auth dapp', () => {
      beforeEach(() => {
        ioMock.mockReturnValue(
          fakeSocket({ error: { code: -32003, message: 'Transaction rejected' } }),
        );
      });

      it('should reject with a rejected error', async () => {
        const error = await sendTransaction().catch(e => e);

        expect(error).toBeInstanceOf(RelayError);
        expect(error.reason).toBe('rejected');
      });
    });

    describe('and the wallet fails for another reason', () => {
      beforeEach(() => {
        ioMock.mockReturnValue(fakeSocket({ error: { code: -32000, message: 'boom' } }));
      });

      it('should reject with the original error', async () => {
        await expect(sendTransaction()).rejects.toEqual({ code: -32000, message: 'boom' });
      });
    });

    describe('and the request expires without an outcome', () => {
      beforeEach(() => {
        ioMock.mockReturnValue(fakeSocket(undefined));
      });

      it('should reject with an expired error', async () => {
        await expect(sendTransaction()).rejects.toMatchObject({
          name: 'RelayError',
          reason: 'expired',
        });
      });
    });
  });
});

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
