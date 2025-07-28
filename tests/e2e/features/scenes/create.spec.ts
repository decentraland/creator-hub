import { test } from '@playwright/test';

import { ElectronUtils } from '../../utils/electron';
import { TestSetupHelper } from '../../utils/testSetup';
import { SceneTestHelper, SCENE_NAME } from './helper';

test.describe('create scene flow', () => {
  test.setTimeout(120_000);

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
