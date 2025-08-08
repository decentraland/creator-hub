import { test } from '@playwright/test';

import { ElectronUtils } from '../../utils/electron';
import { TestSetupHelper } from '../../utils/testSetup';
import { TempDirManager } from '../../utils/tempDirManager';
import { SceneTestHelper, SCENE_NAME } from './helper';
import { DeployTestHelper } from './deployHelper';

test.describe('when deploying a scene', () => {
  test.setTimeout(300_000);
  const WORLD_NAME = process.env.E2E_NAME;

  // Fail the entire test suite if E2E_NAME is not defined
  if (!WORLD_NAME) {
    throw new Error('E2E_NAME environment variable is required for deployment tests');
  }

  test.beforeEach(async () => {
    // Clean up and recreate temp directory before each test
    await TempDirManager.cleanupAndRecreate();
  });

  test.afterEach(async () => {
    // Clean up temp directory after each test
    await TempDirManager.cleanup();
  });

  test.describe('and the user is not authenticated', () => {
    test('should prompt for authentication when trying to deploy, after login continue the Deploy flow', async () => {
      const electronUtils = new ElectronUtils();

      try {
        const page = await electronUtils.getPage();
        const setup = await TestSetupHelper.createTestSetup(page);

        // 1. Create a new scene
        await SceneTestHelper.setupTestSceneWithCreationFlow(setup, SCENE_NAME);

        // 2. Verify publish button is enabled
        await SceneTestHelper.verifyPublishButtonIsEnabled(setup);

        // 3. Click on publish button
        await setup.editorPage.clickPublishButton();

        // 4. Verify publish modal initial is open
        await setup.publishModal.waitForInitialModal();

        // 5. Verify sign in button exists
        await setup.publishModal.getSignInButton().waitFor({ state: 'visible' });

        // 6. Click sign in button and complete simple login flow
        await DeployTestHelper.completeLoginFromPublishModal(setup);
        // 7. Complete the full deploy flow
        await DeployTestHelper.completeDeployFlow(setup, WORLD_NAME);
      } finally {
        await electronUtils.cleanup();
      }
    });
  });
});
