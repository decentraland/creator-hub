import type { ElectronApplication, Page } from 'playwright';

/**
 * A valid 40-hex ethereum address used as the signed-in account in tests. The
 * single-sign-on client validates the address against `/^0x[a-fA-F0-9]{40}$/`
 * before persisting the identity, so this must be a well-formed address.
 */
export const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * A well-formed identity as returned by the auth server's
 * `GET /identities/:id` endpoint. `fetchIdentity` reads `authChain[0].payload`
 * as the signer address, and the SSO client only persists the identity when
 * `expiration` is in the future — so both must be present and valid.
 */
export function buildMockIdentity(address: string = MOCK_ADDRESS) {
  return {
    expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ephemeralIdentity: { address },
    authChain: [{ type: 'SIGNER', payload: address, signature: '' }],
  };
}

export type AuthMockOptions = {
  /** The requestId the stubbed `POST /requests` returns. */
  requestId?: string;
  /** The address the stubbed identity resolves to. */
  address?: string;
};

type RecordedFetch = { url: string; method: string; body: string | null };

/**
 * Installs the sign-in mocks into the page: stubs the auth server (`window.fetch`
 * for `/requests` and `/identities/:id`) and records browser-open calls
 * (`window.open`) instead of opening anything. Recorded data is read back via
 * {@link getOpenCalls} and {@link getFetchCalls}. Mocks only the external
 * boundaries — all in-repo logic runs for real.
 */
export async function installAuthMocks(page: Page, options: AuthMockOptions = {}): Promise<void> {
  const requestId = options.requestId ?? 'e2e-request-id';
  const identity = buildMockIdentity(options.address ?? MOCK_ADDRESS);

  await page.evaluate(
    ({ requestId, identity }) => {
      const w = window as any;
      w.__e2eOpenCalls = [];
      w.__e2eFetchCalls = [];

      // Capture the auth dapp URL instead of opening a real browser window.
      w.open = (url?: string) => {
        w.__e2eOpenCalls.push(url ?? '');
        return null;
      };

      // Stub only the auth-server endpoints; pass everything else through.
      const realFetch = w.fetch.bind(w);
      w.fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : (input?.url ?? String(input));
        const method = (init?.method ?? 'GET').toUpperCase();
        const body = init?.body ?? null;

        if (url.includes('/requests') && method === 'POST') {
          w.__e2eFetchCalls.push({ url, method, body });
          return new Response(JSON.stringify({ requestId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/identities/')) {
          w.__e2eFetchCalls.push({ url, method, body });
          return new Response(JSON.stringify({ identity }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return realFetch(input, init);
      };
    },
    { requestId, identity },
  );
}

/** Reads the recorded `window.open` URLs. */
export function getOpenCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__e2eOpenCalls ?? []);
}

/** Reads the recorded auth-server fetch calls. */
export function getFetchCalls(page: Page): Promise<RecordedFetch[]> {
  return page.evaluate(() => (window as any).__e2eFetchCalls ?? []);
}

/**
 * Fires a sign-in deeplink at the running app through the real macOS entry
 * point (`open-url`), which the main process handles and forwards to the
 * renderer over IPC — exercising the full deeplink path.
 */
export async function fireSignInDeeplink(
  electronApp: ElectronApplication,
  identityId: string,
): Promise<void> {
  await electronApp.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, url);
  }, `dcl-creator-hub://open?signin=${identityId}`);
}
