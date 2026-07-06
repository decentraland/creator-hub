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

const REQUEST_ID = 'e2e-request-id';
const IDENTITY_ID = 'e2e-identity-id';

let electronApp: ElectronApplication;
let cleanup: () => void;
let page: Page;

/**
 * Happy-path sign-in e2e. The auth server (HTTP) and the browser-open are the
 * only external boundaries — both are mocked from the page via runtime
 * injection. Everything else (AuthProvider orchestration, the preload IPC
 * bridge, the main-process deeplink parsing/dispatch, identity persistence)
 * runs for real against the built app.
 *
 * The tests form a dependent chain (open → request → deeplink → signed in) and
 * share a single Electron instance, since cold-launching is the slow,
 * flaky step.
 */
describe('sign in (happy path)', () => {
  beforeAll(async () => {
    ({ electronApp, cleanup } = await launchApp());
    page = await electronApp.firstWindow();
    await Auth.waitUntilReady(page);
    await installAuthMocks(page, { requestId: REQUEST_ID, address: MOCK_ADDRESS });
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
    expect(url).toContain(`/requests/${REQUEST_ID}`);
    expect(url).toContain('targetConfigId=creator-hub');
    expect(url).toContain('flow=deeplink');
  });

  test('creates the sign in request against the auth server', async () => {
    const fetchCalls = await getFetchCalls(page);
    const requestCall = fetchCalls.find(c => c.url.includes('/requests') && c.method === 'POST');
    expect(requestCall, 'POST /requests was not made').toBeDefined();
    expect(requestCall!.body, 'request body missing').toBeTruthy();
    const parsed = JSON.parse(requestCall!.body as string);
    expect(parsed.method).toBe('dcl_personal_sign');

    // The requestId returned by the stub is the one used to open the dapp.
    const openCalls = await getOpenCalls(page);
    expect(openCalls[0]).toContain(`/requests/${REQUEST_ID}`);
  });

  test('completes sign in when the deeplink arrives', async () => {
    await fireSignInDeeplink(electronApp, IDENTITY_ID);

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
