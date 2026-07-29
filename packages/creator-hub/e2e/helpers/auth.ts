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

export type RecordedFetch = { url: string; method: string; body: string | null };

/** Reads back what the installed mocks observed. */
export type AuthMockRecorder = {
  /** URLs the app asked the OS to open in the default browser. */
  openCalls: () => Promise<string[]>;
  /** Auth-server requests the stub answered. */
  fetchCalls: () => Promise<RecordedFetch[]>;
};

/**
 * Patches `window.fetch` inside the renderer to answer only the two auth-server
 * endpoints, passing everything else through. Runs both as an init script (so a reload
 * re-installs it) and immediately (the packaged app's first navigation has already
 * happened by the time `firstWindow()` resolves). Idempotent.
 *
 * **Why not `context.route()`.** Network-layer interception is the more faithful
 * mechanism and it *does* fire for Electron renderer requests — but `route.fulfill()`
 * delivers the body while losing the status code: the renderer sees `status: 0`, so
 * `response.ok` is false and `createSignInRequest` throws
 * `Failed to create auth request (0)`. Verified directly, and independent of CORS
 * headers (an un-intercepted cross-origin POST from the `file://` renderer returns a
 * normal 400, so cross-origin fetch itself is fine). Patching `fetch` in JS sidesteps
 * the network stack entirely and therefore controls the status.
 */
function installFetchStub(
  page: Page,
  payload: { requestId: string; identity: ReturnType<typeof buildMockIdentity> },
) {
  const script = ({
    requestId,
    identity,
  }: {
    requestId: string;
    identity: ReturnType<typeof buildMockIdentity>;
  }) => {
    const w = window as unknown as {
      __e2eFetchCalls?: { url: string; method: string; body: string | null }[];
      __e2eFetchPatched?: boolean;
      fetch: typeof fetch;
    };
    w.__e2eFetchCalls ??= [];
    if (w.__e2eFetchPatched) return;
    w.__e2eFetchPatched = true;

    const realFetch = w.fetch.bind(w);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/requests') && method === 'POST') {
        w.__e2eFetchCalls!.push({ url, method, body: (init?.body as string) ?? null });
        return json({ requestId });
      }
      if (url.includes('/identities/')) {
        w.__e2eFetchCalls!.push({ url, method, body: (init?.body as string) ?? null });
        return json({ identity });
      }
      return realFetch(input, init);
    };
  };

  return Promise.all([page.addInitScript(script, payload), page.evaluate(script, payload)]);
}

/**
 * Mocks only the two external boundaries of sign-in, leaving every line of in-repo logic
 * to run for real: `AuthProvider` orchestration, the preload IPC bridge, main-process
 * deeplink parsing and dispatch, and identity persistence.
 *
 * **The browser handoff is stubbed in the main process.** `lib/auth.ts` calls
 * `window.open` (nothing sets `openBrowser`), which `security-restrictions.ts`'s
 * `setWindowOpenHandler` turns into `shell.openExternal` for allowlisted origins — and
 * both `decentraland.org` and `decentraland.zone` are on that allowlist. Stubbing
 * `shell.openExternal` therefore exercises the real renderer → handler → IPC → main
 * path, whereas patching `window.open` in the renderer would bypass all of it.
 *
 * Deliberately not stubbed: the `io(authServerUrl)` socket in `lib/auth.ts`. Only the
 * wallet-signature flow uses it, not the deeplink flow under test.
 */
export async function installAuthMocks(
  page: Page,
  electronApp: ElectronApplication,
  options: AuthMockOptions = {},
): Promise<AuthMockRecorder> {
  const requestId = options.requestId ?? 'e2e-request-id';
  const identity = buildMockIdentity(options.address ?? MOCK_ADDRESS);

  await installFetchStub(page, { requestId, identity });

  // Only the injected electron module is reachable inside `evaluate` — the main process is
  // bundled ESM, so `require` is not defined there.
  await electronApp.evaluate(({ shell }) => {
    const store = globalThis as unknown as { __e2eOpenExternalCalls?: string[] };
    store.__e2eOpenExternalCalls = [];
    shell.openExternal = async (url: string) => {
      store.__e2eOpenExternalCalls!.push(url);
    };
  });

  return {
    openCalls: () =>
      electronApp.evaluate(
        () =>
          (globalThis as unknown as { __e2eOpenExternalCalls?: string[] }).__e2eOpenExternalCalls ??
          [],
      ),
    fetchCalls: () =>
      page.evaluate(
        () => (window as unknown as { __e2eFetchCalls?: RecordedFetch[] }).__e2eFetchCalls ?? [],
      ),
  };
}

/**
 * Fires a sign-in deeplink through the real macOS `open-url` entry point.
 *
 * @param authRequestId - Correlation id echoed by the auth dapp. `AuthProvider` completes
 * sign in only when it matches the app-generated id; omit it (or pass a foreign one) to
 * fire an uncorrelated link the app must reject.
 */
export async function fireSignInDeeplink(
  electronApp: ElectronApplication,
  identityId: string,
  authRequestId?: string,
): Promise<void> {
  const params = new URLSearchParams({ signin: identityId });
  if (authRequestId) {
    params.set('authRequestId', authRequestId);
  }
  await electronApp.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, url);
  }, `dcl-creator-hub://open?${params.toString()}`);
}
