import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { launchApp } from './helpers/app';
import {
  MOCK_ADDRESS,
  fireSignInDeeplink,
  getFetchCalls,
  getOpenCalls,
  installAuthMocks,
} from './helpers/auth';
import { Auth } from './pageObjects/Auth';

const IDENTITY_ID = 'e2e-identity-id';

/** Identity of a deeplink that did not come from the sign in this app started. */
const FOREIGN_IDENTITY_ID = 'e2e-foreign-identity-id';

/**
 * The sign-in link id is generated locally, so it can only be asserted by shape.
 * Mirrors the UUID v4 form the auth dapp requires of a deep-link request id
 * (`isValidUuidV4`), which rejects a malformed one with an error view.
 */
const REQUESTS_PATH_WITH_UUID_V4 =
  /\/requests\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\?/i;

let electronApp: ElectronApplication;
let cleanup: () => void;
let page: Page;
/** The request id the app generated for the sign-in attempt under test. */
let openedRequestId: string;

/**
 * Happy-path sign-in e2e. The auth server (HTTP) and the browser-open are the
 * only external boundaries — both are mocked from the page via runtime
 * injection. Everything else (AuthProvider orchestration, the preload IPC
 * bridge, the main-process deeplink parsing/dispatch, identity persistence)
 * runs for real against the built app.
 *
 * The tests form a dependent chain (open → deeplink → signed in) and share a
 * single Electron instance, since cold-launching is the slow, flaky step.
 */
describe('sign in (happy path)', () => {
  beforeAll(async () => {
    ({ electronApp, cleanup } = await launchApp());
    page = await electronApp.firstWindow();
    await Auth.waitUntilReady(page);
    await installAuthMocks(page, { address: MOCK_ADDRESS });
  }, 120_000);

  afterAll(async () => {
    try {
      await electronApp?.close();
    } catch {
      // ignore teardown errors so they don't cascade into the next spec file
    } finally {
      cleanup?.();
    }
  });

  test('shows the Sign In button when logged out', async () => {
    expect(await Auth.isSignInButtonVisible(page), 'Sign In button not visible').toBe(true);
    expect(await Auth.isSignedIn(page), 'Avatar button should not be visible yet').toBe(false);
  });

  test('opens the auth dapp with deeplink params on sign in', async () => {
    await Auth.clickSignIn(page);
    await Auth.waitForSignInPage(page);

    const openCalls = await getOpenCalls(page);
    expect(openCalls, 'window.open was not called').toHaveLength(1);
    const url = openCalls[0];
    const requestId = url.match(REQUESTS_PATH_WITH_UUID_V4)?.[1];
    expect(requestId, 'request id is not a locally generated UUID v4').toBeDefined();
    expect(url).toContain('targetConfigId=creator-hub');
    expect(url).toContain('flow=deeplink');

    // The dapp echoes this id back as the deeplink's `authRequestId`.
    openedRequestId = requestId!;
  });

  test('does not create a server-side request for the sign in link', async () => {
    const fetchCalls = await getFetchCalls(page);
    const requestCall = fetchCalls.find(c => c.url.includes('/requests') && c.method === 'POST');
    expect(requestCall, 'POST /requests should no longer be made').toBeUndefined();
  });

  test('ignores a deeplink that does not correlate with the request that was opened', async () => {
    await fireSignInDeeplink(electronApp, FOREIGN_IDENTITY_ID, 'a-foreign-request-id');

    expect(
      await Auth.becomesSignedIn(page, 3_000),
      'an uncorrelated deeplink must not complete sign in',
    ).toBe(false);
    expect(await Auth.isSignInPageVisible(page), 'Sign In page should still be visible').toBe(true);

    const fetchCalls = await getFetchCalls(page);
    expect(
      fetchCalls.some(c => c.url.includes(FOREIGN_IDENTITY_ID)),
      'the foreign identity should never be fetched',
    ).toBe(false);
  });

  test('completes sign in when the deeplink arrives', async () => {
    // The attempt is still live after the uncorrelated link above: a dropped link
    // must not tear down the listener either.
    await fireSignInDeeplink(electronApp, IDENTITY_ID, openedRequestId);

    await Auth.waitForSignedIn(page);
    expect(await Auth.isSignedIn(page), 'Avatar button not visible after sign in').toBe(true);

    // The sign-in page is left once sign in completes (navigate(-1)).
    expect(await Auth.isSignInPageVisible(page), 'Sign In page should be gone').toBe(false);

    // The identity fetch happened and the signer address was persisted.
    const fetchCalls = await getFetchCalls(page);
    expect(fetchCalls.some(c => c.url.includes(`/identities/${IDENTITY_ID}`))).toBe(true);

    const storedAddress = await page.evaluate(() =>
      window.localStorage.getItem('auth-server-provider-address'),
    );
    expect(storedAddress).toBe(MOCK_ADDRESS.toLowerCase());
  });
});
