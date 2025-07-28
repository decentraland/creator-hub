import { expect } from '@playwright/test';
import type { TestSetup } from '../../utils/testSetup';
import { createAndStoreAuthIdentity } from '../../utils/createAuthIdentity';

export class LoginTestHelper {
  /**
   * Complete login flow from home to authenticated state
   */
  static async completeLoginFlow(setup: TestSetup): Promise<void> {
    // 1. Navigate to home page
    await setup.homePage.navigate();

    // 2. Verify sign-in option is available
    const hasSignInOption = await setup.homePage.hasSignInOption();
    if (!hasSignInOption) {
      throw new Error('Sign-in option is not available');
    }

    // 3. Click sign-in to navigate to sign-in page
    await setup.homePage.clickSignIn();

    // 4. Verify we're on the sign-in page
    const isSignInPageVisible = await setup.signInPage.isVisible();
    if (!isSignInPageVisible) {
      throw new Error('Sign-in page is not visible');
    }

    // 5. Verify verification code is displayed
    const hasVerificationCode = await setup.signInPage.hasVerificationCode();
    if (!hasVerificationCode) {
      throw new Error('Verification code is not displayed');
    }

    await createAndStoreAuthIdentity(setup.page);

    // 6. Verify we're redirected back to home page
    const isHomePageVisible = await setup.homePage.isVisible();
    if (!isHomePageVisible) {
      throw new Error('Home page is not visible after login');
    }

    // 7. Verify user is now authenticated
    const isAuthenticated = await setup.homePage.isUserAuthenticated();
    if (!isAuthenticated) {
      throw new Error('User is not authenticated after login flow');
    }
  }

  /**
   * Verify user is authenticated
   */
  static async verifyUserIsAuthenticated(setup: TestSetup): Promise<void> {
    const isAuthenticated = await setup.homePage.isUserAuthenticated();
    expect(isAuthenticated).toBe(true);
  }

  /**
   * Verify user is not authenticated
   */
  static async verifyUserIsNotAuthenticated(setup: TestSetup): Promise<void> {
    const isAuthenticated = await setup.homePage.isUserAuthenticated();
    expect(isAuthenticated).toBe(false);
  }
}
