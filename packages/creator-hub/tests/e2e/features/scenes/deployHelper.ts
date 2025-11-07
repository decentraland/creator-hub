import { expect } from '@playwright/test';
import { createAndStoreAuthIdentity } from '../../utils/createAuthIdentity';
import type { TestSetup } from '../../utils/testSetup';
import { SceneTestHelper } from './helper';

export class DeployTestHelper {
  /**
   * Click sign in button in publish modal and complete simple login flow
   */
  static async completeLoginFromPublishModal(setup: TestSetup): Promise<void> {
    // Click sign in button in publish modal
    await setup.publishModal.clickSignIn();

    // Wait for redirect to sign-in page
    await setup.signInPage.waitForPageLoad();

    // Verify verification code is displayed
    const hasVerificationCode = await setup.signInPage.hasVerificationCode();
    expect(hasVerificationCode).toBe(true);

    await createAndStoreAuthIdentity(setup.page);

    // Wait for redirect back to editor page (automatic after verification) and fetch names
    await new Promise(resolve => setTimeout(resolve, 10000));
    await setup.editorPage.waitForIframeToBeVisible();
  }

  /**
   * Complete full deploy flow for authenticated user
   */
  static async completeDeployFlow(setup: TestSetup, worldName: string): Promise<void> {
    // 1. Verify publish button is enabled
    await SceneTestHelper.verifyPublishButtonIsEnabled(setup);

    // 2. Click on publish button
    await setup.editorPage.clickPublishButton();

    // 3. Wait for initial modal and verify options exist
    await setup.publishModal.waitForInitialModal();

    // 4. Click on worlds option
    await setup.publishModal.clickWorldsOption();

    // 5. Check if user has names or not
    const hasEmptyNames = await setup.publishModal.hasEmptyNames();

    if (hasEmptyNames) {
      // User has no names - this would typically end the flow
      return;
    }

    // 6. Select specific world
    await setup.publishModal.selectWorld(worldName);

    // 7. Check if world has content
    const hasReplaceContent = await setup.publishModal.hasWorldReplaceContent();

    if (hasReplaceContent) {
      // Check world replace content checkbox
      await setup.publishModal.checkWorldReplaceContent();
    }

    // 8. Click world selection action
    await setup.publishModal.clickWorldSelectionAction();

    // 9. Click publish button in deploy modal
    await setup.publishModal.clickDeployPublishButton();

    // 10. Check if warning exists
    const hasWarning = await setup.publishModal.hasDeployWarning();

    if (hasWarning) {
      // Click continue button in deploy warning
      await setup.publishModal.clickDeployWarningContinue();
    }

    let isDeploying = false;
    setup.page.on('console', msg => {
      const text = msg.text();
      if (/^Attempt \d+\/\d+ failed\. Retrying in \d+ms\.\.\.$/.test(text)) {
        console.log(`Deploy retry: ${text}`);
        isDeploying = true;
      }
    });

    // 11. Wait for deploy jump button to be visible
    try {
      await Promise.race([
        setup.publishModal.waitForDeployJumpButton(),
        setup.publishModal.waitForSuccessModal(),
      ]);
    } catch (error) {
      // If deploy is not in progress, throw error
      console.log('Deploy error', error);
      console.log('Is deploying', isDeploying);
      if (!isDeploying) {
        throw error;
      }
    }
  }
}
