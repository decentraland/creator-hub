import { chromium, expect, test } from '@playwright/test';
import { launchApp } from '../../helpers/app';
import { captureOpenExternal, fireSignInDeeplink } from '../../helpers/auth';
import {
  captureDeepLink,
  liveAuthDappUrl,
  readDeepLink,
  saveLiveState,
  watchAuthApi,
} from '../../helpers/live-auth';
import { installLiveWallet } from '../../helpers/live-wallet';
import { Auth } from '../../pageObjects/Auth';

const BROWSER_WALLET_BUTTON = 'secondary-test-id-metamask-button';

test('signs in for real and captures the identity', async () => {
  test.skip(
    !process.env.E2E_PRIVATE_KEY,
    'set E2E_PRIVATE_KEY (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  const { electronApp, cleanup } = await launchApp({ extraArgs: ['--env=dev'] });
  const headed = !!process.env.HEADED;
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 500 : 0 });

  try {
    const appPage = await electronApp.firstWindow();
    await Auth.waitUntilReady(appPage);

    const openCalls = await captureOpenExternal(electronApp);
    await Auth.clickSignIn(appPage);
    await Auth.waitForSignInPage(appPage);
    await expect
      .poll(async () => (await openCalls()).length, {
        message: 'the app never asked the OS to open the auth dapp',
      })
      .toBe(1);
    const [openedUrl] = await openCalls();

    const dappPage = await browser.newPage();
    const authApi = watchAuthApi(dappPage);
    await installLiveWallet(dappPage);
    await captureDeepLink(dappPage);
    await dappPage.goto(liveAuthDappUrl(openedUrl), { waitUntil: 'domcontentloaded' });
    await dappPage.getByTestId(BROWSER_WALLET_BUTTON).click();

    await expect
      .poll(() => readDeepLink(dappPage), {
        message: 'the auth dapp never fired the creator-hub deeplink',
        timeout: 120_000,
      })
      .toBeTruthy();
    authApi.assertTestnetBackend();

    const deepLink = new URL((await readDeepLink(dappPage))!);
    const identityId = deepLink.searchParams.get('signin');
    expect(identityId, 'the deeplink carries no identity id').toBeTruthy();

    await fireSignInDeeplink(
      electronApp,
      identityId!,
      deepLink.searchParams.get('authRequestId') ?? undefined,
    );
    await Auth.waitForSignedIn(appPage);
    await saveLiveState(appPage);
  } finally {
    await browser.close().catch(() => undefined);
    await electronApp.close().catch(() => undefined);
    cleanup();
  }
});
