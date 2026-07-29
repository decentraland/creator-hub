import { expect, test } from '../fixtures';
import {
  type StubResponse,
  fireSignInDeeplink,
  installAuthMocks,
  requestIdFromAuthUrl,
} from '../helpers/auth';
import { Auth } from '../pageObjects/Auth';

const IDENTITY_ID = 'e2e-identity-id';

/**
 * The snackbar the AuthProvider pushes on failure. Severity is part of the hook, so a passing
 * assertion means an *error* was surfaced, not merely some notification.
 *
 * Always filtered by expected text: a packaged build pushes its own auto-updater errors on
 * startup ("We couldn't check for updates", "Unable to install the update") because there is
 * no release to check against, so an unfiltered locator hits three elements and trips strict
 * mode. Filtering also states the intent more precisely — *an* error snackbar carrying this
 * message is visible — and needs no production change to suppress the noise.
 */
const ERROR_SNACKBAR = '[data-testid="snackbar-generic-error"]';

/**
 * The sign-in failure surface. `lib/auth.ts` maps an auth-server status onto a
 * `SignInError.reason`, and `AuthProvider/component.tsx` maps that reason onto a translated
 * message — so each case is asserted through the message the user actually sees, not through
 * a rejected promise.
 *
 * These are only expressible because the fetch stub controls the response status.
 * `route.fulfill()` reports `status: 0` to an Electron renderer regardless of what it is
 * given, MSW's browser integration cannot register a Service Worker on the packaged app's
 * `file://` origin, and Synpress would exercise the auth dapp rather than creator-hub. See
 * `learnings/phase-3.json`.
 */
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
    // 200 with a body the app cannot read: `fetchIdentity` requires
    // `identity.authChain[0].payload` to be a string. A status-only mock could not express
    // this case at all — it is about response *shape*.
    name: 'malformed identity body (200)',
    identityResponse: { status: 200, body: { identity: {} } },
    message: 'Signin failed. Please try again.',
  },
];

test.describe('sign in failures', { tag: '@offline' }, () => {
  for (const failure of DEEPLINK_FAILURES) {
    test(`surfaces an error on ${failure.name}`, async ({ electronApp, page }) => {
      const errorSaying = (text: string) => page.locator(ERROR_SNACKBAR).filter({ hasText: text });

      const mocks = await installAuthMocks(page, electronApp, {
        identityResponse: failure.identityResponse,
      });

      await Auth.clickSignIn(page);
      await Auth.waitForSignInPage(page);

      await expect.poll(async () => (await mocks.openCalls()).length).toBe(1);
      const [url] = await mocks.openCalls();
      await fireSignInDeeplink(electronApp, IDENTITY_ID, requestIdFromAuthUrl(url));

      await expect(errorSaying(failure.message)).toBeVisible();
      expect(await Auth.isSignedIn(page), 'must not appear signed in after a failure').toBe(false);
    });
  }
});
