import { expect, test } from '../../fixtures';
import { liveWalletAddress } from '../../helpers/live-wallet';
import { Auth } from '../../pageObjects/Auth';

const STORAGE_KEY_ADDRESS = 'auth-server-provider-address';

test.describe('live identity', { tag: '@live' }, () => {
  test.skip(
    !process.env.E2E_PRIVATE_KEY,
    'set E2E_PRIVATE_KEY (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  test('boots signed in as the e2e wallet', async ({ signedInLive }) => {
    expect(await Auth.isSignedIn(signedInLive), 'avatar button not visible').toBe(true);
    expect(await Auth.isSignInButtonVisible(signedInLive), 'still showing Sign In').toBe(false);

    const storedAddress = await signedInLive.evaluate(
      key => localStorage.getItem(key),
      STORAGE_KEY_ADDRESS,
    );
    expect(storedAddress?.toLowerCase()).toBe(liveWalletAddress().toLowerCase());
  });
});
