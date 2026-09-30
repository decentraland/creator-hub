import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from '../helpers/app';
import {
  MOCK_ADDRESS,
  type AuthMockRecorder,
  fireSignInDeeplink,
  installAuthMocks,
} from '../helpers/auth-mocks';
import { Auth } from '../pages/Auth';

const IDENTITY_ID = 'e2e-identity-id';
const FOREIGN_IDENTITY_ID = 'e2e-foreign-identity-id';

const REQUESTS_PATH_WITH_UUID_V4 =
  /\/requests\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\?/i;

let electronApp: ElectronApplication;
let cleanup: () => void;
let page: Page;
let auth: Auth;
let mocks: AuthMockRecorder;
let openedRequestId: string;

test.describe.configure({ mode: 'serial' });

test.describe('sign in (happy path)', { tag: '@offline' }, () => {
  test.beforeAll(async () => {
    ({ electronApp, cleanup } = await launchApp());
    page = await electronApp.firstWindow();
    auth = new Auth(page);
    await auth.waitUntilReady();
    mocks = await installAuthMocks(page, electronApp, { address: MOCK_ADDRESS });
  });

  test.afterAll(async () => {
    await electronApp?.close().catch(() => undefined);
    cleanup?.();
  });

  test('shows the Sign In button when logged out', async () => {
    expect(await auth.isSignInButtonVisible(), 'Sign In button not visible').toBe(true);
    expect(await auth.isSignedIn(), 'Avatar button should not be visible yet').toBe(false);
  });

  test('opens the auth dapp with deeplink params on sign in', async () => {
    await auth.clickSignIn();
    await auth.waitForSignInPage();

    await expect
      .poll(async () => (await mocks.openCalls()).length, {
        message: 'the app never asked the OS to open the auth dapp',
      })
      .toBe(1);

    const [url] = await mocks.openCalls();
    const requestId = url.match(REQUESTS_PATH_WITH_UUID_V4)?.[1];
    expect(requestId, 'request id is not a locally generated UUID v4').toBeDefined();
    expect(url).toContain('targetConfigId=creator-hub');
    expect(url).toContain('flow=deeplink');

    openedRequestId = requestId!;
  });

  test('does not create a server-side request for the sign in link', async () => {
    const requestCall = (await mocks.fetchCalls()).find(
      c => c.url.includes('/requests') && c.method === 'POST',
    );
    expect(requestCall, 'POST /requests should no longer be made').toBeUndefined();
  });

  test('ignores a deeplink that does not correlate with the request that was opened', async () => {
    await fireSignInDeeplink(electronApp, FOREIGN_IDENTITY_ID, 'a-foreign-request-id');

    expect(
      await auth.becomesSignedIn(3_000),
      'an uncorrelated deeplink must not complete sign in',
    ).toBe(false);
    expect(await auth.isSignInPageVisible(), 'Sign In page should still be visible').toBe(true);

    const foreignFetched = (await mocks.fetchCalls()).some(c =>
      c.url.includes(FOREIGN_IDENTITY_ID),
    );
    expect(foreignFetched, 'the foreign identity should never be fetched').toBe(false);
  });

  test('completes sign in when the deeplink arrives', async () => {
    await fireSignInDeeplink(electronApp, IDENTITY_ID, openedRequestId);

    await auth.waitForSignedIn();
    expect(await auth.isSignedIn(), 'Avatar button not visible after sign in').toBe(true);
    expect(await auth.isSignInPageVisible(), 'Sign In page should be gone').toBe(false);

    const identityFetched = (await mocks.fetchCalls()).some(c =>
      c.url.includes(`/identities/${IDENTITY_ID}`),
    );
    expect(identityFetched).toBe(true);

    const storedAddress = await page.evaluate(() =>
      window.localStorage.getItem('auth-server-provider-address'),
    );
    expect(storedAddress).toBe(MOCK_ADDRESS.toLowerCase());
  });
});
