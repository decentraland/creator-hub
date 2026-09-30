import { expect, test } from '../fixtures';
import { walletAddress } from '../helpers/wallet-setup';
import { Auth } from '../pages/Auth';

const STORAGE_KEY_ADDRESS = 'auth-server-provider-address';

test.describe('live identity', { tag: '@live' }, () => {
  test.skip(
    !process.env.E2E_PRIVATE_KEY,
    'set E2E_PRIVATE_KEY (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  test('boots signed in as the e2e wallet', async ({ page }) => {
    const auth = new Auth(page);
    expect(await auth.isSignedIn(), 'avatar button not visible').toBe(true);
    expect(await auth.isSignInButtonVisible(), 'still showing Sign In').toBe(false);

    const storedAddress = await page.evaluate(
      key => localStorage.getItem(key),
      STORAGE_KEY_ADDRESS,
    );
    expect(storedAddress?.toLowerCase()).toBe(walletAddress().toLowerCase());
  });
});
