import { test } from '@playwright/test';

import { ElectronUtils } from '../../utils/electron';
import { TestSetupHelper } from '../../utils/testSetup';
import { TempDirManager } from '../../utils/tempDirManager';
import { SceneTestHelper, SCENE_NAME } from './helper';

test.describe('create scene flow', () => {
  test.setTimeout(120_000);

  test.beforeEach(async () => {
    // Clean up and recreate temp directory before each test
    await TempDirManager.cleanupAndRecreate();
  });

  test.afterEach(async () => {
    // Clean up temp directory after each test
    await TempDirManager.cleanup();
  });

  test('should complete full scene creation flow from home to editor', async () => {
    const electronUtils = new ElectronUtils();

    try {
      // Get the Electron page
      const electronPage = await electronUtils.getPage();
      const setup = await TestSetupHelper.createTestSetup(electronPage);

      // Use the scene helper to create the scene
      await SceneTestHelper.setupTestSceneWithCreationFlow(setup, SCENE_NAME);

      // Verify preview button is enabled and ready
      await SceneTestHelper.verifyPreviewButtonIsEnabled(setup);
    } finally {
      await electronUtils.cleanup();
    }
  });
});
