import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from '../helpers/app';
import {
  type StubResponse,
  captureOpenExternal,
  fireSignInDeeplink,
  installAuthMocks,
  requestIdFromAuthUrl,
  setIdentityResponse,
} from '../helpers/auth-mocks';
import { Auth } from '../pages/Auth';

const IDENTITY_ID = 'e2e-identity-id';
const ERROR_SNACKBAR = '[data-testid="snackbar-generic-error"]';

const DEEPLINK_FAILURES: {
  name: string;
  identityResponse: StubResponse;
  message: string;
}[] = [
  {
    name: 'identity not found (404)',
    identityResponse: { status: 404 },
    message: 'Sign-in could not be completed. Please try signing in again.',
  },
  {
    name: 'identity expired (410)',
    identityResponse: { status: 410 },
    message: 'Your sign-in request expired. Please try signing in again.',
  },
  {
    name: 'network mismatch (403)',
    identityResponse: { status: 403 },
    message: "Couldn't complete sign-in. Disable any VPN or browser private relay and try again.",
  },
  {
    name: 'auth server error (500)',
    identityResponse: { status: 500 },
    message: 'Signin failed. Please try again.',
  },
  {
    name: 'malformed identity body (200)',
    identityResponse: { status: 200, body: { identity: {} } },
    message: 'Signin failed. Please try again.',
  },
];

let electronApp: ElectronApplication;
let cleanup: () => void;
let page: Page;
let auth: Auth;

test.describe.configure({ mode: 'serial' });

test.describe('sign in failures', { tag: '@offline' }, () => {
  test.beforeAll(async () => {
    ({ electronApp, cleanup } = await launchApp());
    page = await electronApp.firstWindow();
    auth = new Auth(page);
    await auth.waitUntilReady();
    await installAuthMocks(page, electronApp);
  });

  test.afterAll(async () => {
    await electronApp?.close().catch(() => undefined);
    cleanup?.();
  });

  test.beforeEach(async () => {
    await page.reload();
    await auth.waitUntilReady();
  });

  for (const failure of DEEPLINK_FAILURES) {
    test(`surfaces an error on ${failure.name}`, async () => {
      const errorSaying = (text: string) => page.locator(ERROR_SNACKBAR).filter({ hasText: text });
      await setIdentityResponse(page, failure.identityResponse);

      const openCalls = await captureOpenExternal(electronApp);
      await auth.clickSignIn();
      await auth.waitForSignInPage();

      await expect.poll(async () => (await openCalls()).length).toBe(1);
      const [url] = await openCalls();
      await fireSignInDeeplink(electronApp, IDENTITY_ID, requestIdFromAuthUrl(url));

      await expect(errorSaying(failure.message)).toBeVisible();
      expect(await auth.isSignedIn(), 'must not appear signed in after a failure').toBe(false);
    });
  }
});
