import { test, expect } from '@playwright/test';

import { ElectronUtils } from '../utils/electron';
import { TestSetupHelper } from '../utils/testSetup';

test.describe('login flow', () => {
  test('should complete full login flow from home to authenticated state', async () => {
    const electronUtils = new ElectronUtils();

    try {
      const page = await electronUtils.getPage();
      const setup = await TestSetupHelper.createTestSetup(page);

      // 1. Navigate to home page
      await setup.homePage.navigate();

      // 2. Verify sign-in option is available
      const hasSignInOption = await setup.homePage.hasSignInOption();
      expect(hasSignInOption).toBe(true);

      // 3. Click sign-in to navigate to sign-in page
      await setup.homePage.clickSignIn();

      // 4. Verify we're on the sign-in page
      const isSignInPageVisible = await setup.signInPage.isVisible();
      expect(isSignInPageVisible).toBe(true);

      // 5. Verify verification code is displayed
      const hasVerificationCode = await setup.signInPage.hasVerificationCode();
      expect(hasVerificationCode).toBe(true);

      // 6. Verify we're redirected back to home page
      const isHomePageVisible = await setup.homePage.isVisible();
      expect(isHomePageVisible).toBe(true);

      // 7. Verify user is now authenticated
      const isAuthenticated = await setup.homePage.isUserAuthenticated();
      expect(isAuthenticated).toBe(true);
    } finally {
      await electronUtils.cleanup();
    }
  });
});
